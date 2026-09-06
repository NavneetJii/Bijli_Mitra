
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const CASHFREE_VERSION = "2025-01-01";
const ADVANCE_AMOUNT = 21;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("CASHFREE_CLIENT_ID");
    const clientSecret = Deno.env.get("CASHFREE_CLIENT_SECRET");
    const environment = Deno.env.get("CASHFREE_ENVIRONMENT") || "sandbox";
    const appUrl = Deno.env.get("APP_URL");

    if (!clientId || !clientSecret) {
      return json({ error: "Cashfree server credentials are not configured." }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRole);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Invalid authentication session." }, 401);

    const body = await req.json();
    const paymentType = body?.payment_type;

    if (!["booking_advance", "final_payment"].includes(paymentType)) {
      return json({ error: "Invalid payment_type." }, 400);
    }

    let amount: number;
    let orderId: string | null = null;
    let draftLocationId: string | null = null;
    let draftItems: unknown[] | null = null;
    let orderNote: string;

    if (paymentType === "booking_advance") {
      // No order exists yet -- the order is only created once this ₹21
      // payment actually succeeds (see cashfree-webhook +
      // create_order_from_paid_booking). The frontend sends the cart
      // instead of an order_id.
      const serviceLocationId = body?.service_location_id;
      const items = body?.items;

      if (!serviceLocationId || typeof serviceLocationId !== "string") {
        return json({ error: "service_location_id is required." }, 400);
      }
      if (!Array.isArray(items) || items.length === 0) {
        return json({ error: "At least one service item is required." }, 400);
      }

      const { data: location, error: locationError } = await admin
        .from("service_locations")
        .select("id, customer_id")
        .eq("id", serviceLocationId)
        .single();

      if (locationError || !location || location.customer_id !== user.id) {
        return json({ error: "Invalid service location." }, 400);
      }

      const normalizedItems: { service_id: string; quantity: number }[] = [];
      for (const raw of items) {
        const serviceId = raw?.service_id;
        const quantity = Number(raw?.quantity);
        if (!serviceId || typeof serviceId !== "string") {
          return json({ error: "Each item needs a service_id." }, 400);
        }
        if (!Number.isInteger(quantity) || quantity <= 0) {
          return json({ error: "Each item needs a valid quantity." }, 400);
        }

        const { data: service, error: serviceError } = await admin
          .from("services")
          .select("id, is_active")
          .eq("id", serviceId)
          .single();

        if (serviceError || !service || !service.is_active) {
          return json({ error: "One or more selected services are invalid." }, 400);
        }

        normalizedItems.push({ service_id: serviceId, quantity });
      }

      amount = ADVANCE_AMOUNT;
      draftLocationId = serviceLocationId;
      draftItems = normalizedItems;
      orderNote = `BijliMitra ₹21 booking token for ${user.id}`;

      // Reuse an existing pending draft payment (no order yet) for this
      // customer instead of creating a fresh Cashfree order every time the
      // checkout modal is reopened.
      const { data: existingDraft } = await admin
        .from("payments")
        .select("*")
        .eq("customer_id", user.id)
        .eq("payment_type", "booking_advance")
        .eq("status", "pending")
        .is("order_id", null)
        .not("cashfree_order_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingDraft?.cashfree_order_id) {
        const base = environment === "production" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com";
        const getResp = await fetch(`${base}/pg/orders/${encodeURIComponent(existingDraft.cashfree_order_id)}`, {
          headers: {
            "accept": "application/json",
            "x-api-version": CASHFREE_VERSION,
            "x-client-id": clientId,
            "x-client-secret": clientSecret,
          },
        });
        if (getResp.ok) {
          const cf = await getResp.json();
          if (cf.payment_session_id) {
            // Refresh the draft cart in case the customer changed it.
            await admin.from("payments").update({
              draft_service_location_id: draftLocationId,
              draft_items: draftItems,
              updated_at: new Date().toISOString(),
            }).eq("id", existingDraft.id);

            return json({
              payment_session_id: cf.payment_session_id,
              cashfree_order_id: existingDraft.cashfree_order_id,
              payment_id: existingDraft.id,
            });
          }
        }
      }
    } else {
      // final_payment: the order already exists by this point in the flow
      // (customer confirmed the bill, electrician verified the completed PIN).
      orderId = body?.order_id;
      if (!orderId || typeof orderId !== "string") {
        return json({ error: "order_id is required." }, 400);
      }

      const { data: order, error: orderError } = await admin
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (orderError || !order) return json({ error: "Order not found." }, 404);
      if (order.customer_id !== user.id) return json({ error: "You do not own this order." }, 403);
      if (order.status !== "final_payment_pending") {
        return json({ error: "Order is not awaiting final payment." }, 409);
      }

      amount = Number(order.amount_due);
      if (!(amount > 0)) return json({ error: "No final amount is due." }, 400);
      orderNote = `BijliMitra final payment for ${orderId}`;

      // Reuse a pending Cashfree order when possible.
      const { data: existing } = await admin
        .from("payments")
        .select("*")
        .eq("order_id", orderId)
        .eq("payment_type", "final_payment")
        .eq("status", "pending")
        .not("cashfree_order_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.cashfree_order_id) {
        const base = environment === "production" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com";
        const getResp = await fetch(`${base}/pg/orders/${encodeURIComponent(existing.cashfree_order_id)}`, {
          headers: {
            "accept": "application/json",
            "x-api-version": CASHFREE_VERSION,
            "x-client-id": clientId,
            "x-client-secret": clientSecret,
          },
        });
        if (getResp.ok) {
          const cf = await getResp.json();
          if (cf.payment_session_id) return json({
            payment_session_id: cf.payment_session_id,
            cashfree_order_id: existing.cashfree_order_id,
            payment_id: existing.id,
          });
        }
      }

      // Mark the order as having a payment attempt in flight.
      await admin.from("orders").update({
        final_payment_status: "pending",
        updated_at: new Date().toISOString(),
      }).eq("id", orderId);
    }

    const cashfreeOrderId = `BM_${paymentType === "booking_advance" ? "ADV" : "FINAL"}_${(orderId ?? user.id).replaceAll("-", "").slice(0, 20)}_${crypto.randomUUID().slice(0, 8)}`;
    const base = environment === "production" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com";
    const customerPhone = String(user.phone || "9999999999").replace(/\D/g, "").slice(-10) || "9999999999";

    const cfBody: Record<string, unknown> = {
      order_id: cashfreeOrderId,
      order_currency: "INR",
      order_amount: amount,
      customer_details: {
        customer_id: user.id,
        customer_email: user.email || "customer@bijlimitra.local",
        customer_phone: customerPhone,
      },
      order_note: orderNote,
    };

    if (appUrl) {
      cfBody.order_meta = {
        return_url: `${appUrl}/?cashfree_order_id={order_id}`,
        notify_url: `${appUrl}/functions/v1/cashfree-webhook`,
      };
    }

    const cfResp = await fetch(`${base}/pg/orders`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "x-api-version": CASHFREE_VERSION,
        "x-client-id": clientId,
        "x-client-secret": clientSecret,
        "x-idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify(cfBody),
    });

    const cfText = await cfResp.text();
    let cf: any;
    try { cf = JSON.parse(cfText); } catch { cf = { raw: cfText }; }

    if (!cfResp.ok) {
      console.error("Cashfree create order failed", cf);
      return json({ error: "Cashfree order creation failed.", details: cf }, 502);
    }

    const paymentRow: Record<string, unknown> = {
      order_id: orderId,
      customer_id: user.id,
      payment_type: paymentType,
      amount,
      status: "pending",
      cashfree_order_id: cf.order_id || cashfreeOrderId,
      payment_method: null,
      qr_reference: null,
      updated_at: new Date().toISOString(),
    };

    if (paymentType === "booking_advance") {
      paymentRow.draft_service_location_id = draftLocationId;
      paymentRow.draft_items = draftItems;
    }

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .insert(paymentRow)
      .select("*")
      .single();

    if (paymentError) {
      console.error("Payment row insert failed", paymentError);
      return json({ error: "Cashfree order created but local payment record failed.", cashfree_order_id: cf.order_id }, 500);
    }

    return json({
      payment_session_id: cf.payment_session_id,
      cashfree_order_id: cf.order_id,
      payment_id: payment.id,
      amount,
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error." }, 500);
  }
});
