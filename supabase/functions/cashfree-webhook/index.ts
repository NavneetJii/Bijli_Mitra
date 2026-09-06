
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-signature, x-webhook-timestamp",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const VERSION = "2025-01-01";

function json(body: unknown, status=200) {
  return new Response(JSON.stringify(body), {status, headers:cors});
}

async function hmacBase64(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  let binary = "";
  for (const b of new Uint8Array(sig)) binary += String.fromCharCode(b);
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:cors});
  if (req.method !== "POST") return json({error:"Method not allowed"},405);

  try {
    const secret = Deno.env.get("CASHFREE_CLIENT_SECRET");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!secret || !serviceRole || !supabaseUrl) return json({error:"Webhook secrets not configured"},500);

    const raw = await req.text();
    const signature = req.headers.get("x-webhook-signature");
    const timestamp = req.headers.get("x-webhook-timestamp");
    if (!signature || !timestamp) return json({error:"Missing Cashfree webhook signature"},401);

    const expected = await hmacBase64(secret, timestamp + raw);
    if (expected !== signature) return json({error:"Invalid Cashfree webhook signature"},401);

    const payload = JSON.parse(raw);
    const orderId = payload?.data?.order?.order_id;
    const payment = payload?.data?.payment;
    if (!orderId) return json({error:"Missing Cashfree order id"},400);

    const admin = createClient(supabaseUrl, serviceRole);

    const { data: localPayment, error: lpError } = await admin
      .from("payments")
      .select("*")
      .eq("cashfree_order_id", orderId)
      .single();

    if (lpError || !localPayment) return json({received:true, ignored:"unknown_order"});

    const paymentStatus = String(payment?.payment_status || "").toUpperCase();
    const cfPaymentId = payment?.cf_payment_id ? String(payment.cf_payment_id) : null;
    const method = payment?.payment_method ? JSON.stringify(payment.payment_method) : null;

    if (paymentStatus !== "SUCCESS") {
      await admin.from("payments").update({
        status: paymentStatus === "FAILED" ? "failed" : "pending",
        cashfree_payment_id: cfPaymentId,
        payment_method: method,
        updated_at: new Date().toISOString(),
      }).eq("id", localPayment.id);

      // Reflect the failure/pending state on the order too, when an order
      // already exists for this payment. A booking_advance payment that
      // hasn't succeeded yet has no order at all (by design), so there's
      // nothing to update on that side -- the failed/abandoned checkout
      // simply leaves zero order rows behind.
      if (localPayment.payment_type === "final_payment" && localPayment.order_id) {
        await admin.from("orders").update({
          final_payment_status: paymentStatus === "FAILED" ? "failed" : "pending",
          updated_at: new Date().toISOString(),
        }).eq("id", localPayment.order_id);
      }

      return json({received:true,status:paymentStatus});
    }

    // Guard against duplicate webhook deliveries (Cashfree retries on timeout/
    // non-2xx, and can also send more than one callback for the same event).
    // If we've already recorded this payment as successful, do NOT re-run the
    // side effects below (amount_paid increment, PIN generation, order
    // completion) a second time.
    if (localPayment.status === "success") {
      return json({ received: true, status: "SUCCESS", note: "already_processed" });
    }

    // Atomic, conditional update: only flips to success if it isn't already
    // success. If two webhook deliveries race each other, only one of them
    // will find a row to update (rowCount 0 on the loser), so only one will
    // proceed to run the side effects below.
    const { data: updatedRows, error: updateError } = await admin
      .from("payments")
      .update({
        status: "success",
        cashfree_payment_id: cfPaymentId,
        payment_method: method,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", localPayment.id)
      .neq("status", "success")
      .select("id");

    if (updateError) {
      console.error("Failed to mark payment success", updateError);
      return json({ error: "Failed to update payment" }, 500);
    }

    if (!updatedRows || updatedRows.length === 0) {
      // Another concurrent delivery already flipped it to success. Bail out
      // before touching the order or calling any RPCs again.
      return json({ received: true, status: "SUCCESS", note: "already_processed" });
    }

    if (localPayment.payment_type === "booking_advance") {
      // The order does NOT exist yet -- it's created right here, now that
      // the ₹21 has actually succeeded, from the cart data stashed on the
      // payment row by create-cashfree-payment. This function is idempotent:
      // if it's ever called twice for the same payment it just returns the
      // order it already created the first time, so nothing gets duplicated.
      const { data: order, error: orderCreateError } = await admin.rpc(
        "create_order_from_paid_booking",
        { p_payment_id: localPayment.id }
      );

      if (orderCreateError || !order) {
        console.error("create_order_from_paid_booking failed", orderCreateError);
        // Payment is recorded as successful either way -- this is visible
        // in Edge logs and safe to retry/resolve manually without any risk
        // of double-charging the customer.
        return json({ received: true, status: "SUCCESS", order_creation_failed: true });
      }

      // Call the trusted server-only PIN function. It's guarded against
      // being called more than once for the same order.
      const { error: pinError } = await admin.rpc("generate_order_pins", {
        p_order_id: order.id
      });
      if (pinError) console.error("generate_order_pins failed", pinError);

    } else if (localPayment.payment_type === "final_payment") {
      if (!localPayment.order_id) {
        console.error("final_payment webhook with no order_id on payment", localPayment.id);
        return json({ received: true, status: "SUCCESS", ignored: "missing_order_id" });
      }
      const paidAmount = Number(localPayment.amount);
      const { error: completeError } = await admin.rpc("complete_order_after_payment", {
        p_order_id: localPayment.order_id,
        p_payment_id: localPayment.id,
        p_paid_amount: paidAmount
      });
      if (completeError) console.error("complete_order_after_payment failed", completeError);
    }

    return json({received:true,status:"SUCCESS"});
  } catch (e) {
    console.error(e);
    return json({error:e instanceof Error?e.message:"Unexpected webhook error"},500);
  }
});
