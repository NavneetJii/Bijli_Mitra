import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const CASHFREE_VERSION = "2025-01-01";
const ADVANCE_AMOUNT = 51;

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
    const renderAs = body?.render_as;

    if (["booking_advance", "final_payment"].includes(paymentType) === false) {
      return json({ error: "Invalid payment_type." }, 400);
    }

    let amount: number;
    let orderId: string | null = null;
    let draftLocationId: string | null = null;
    let draftItems: unknown[] | null = null;
    let orderNote: string;
    let paymentCustomerId: string = user.id;

    if (paymentType === "booking_advance") {
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
      orderNote = `BijliMitra ₹51 booking token for ${user.id}`;

      // NOTE: deliberately NOT reusing any existing pending draft here.
      // Reuse logic (matching on a recent pending payment + an Cashfree
      // "is this session ACTIVE" check) repeatedly caused stale sessions to
      // get served again after the price changed, or after long sandbox
      // testing gaps -- charging an old amount without any visible error.
      // A fresh Cashfree order is created on every single attempt instead.
      // The only cost is a few extra sandbox test orders, which is trivial.
    } else {
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

      const isCustomer = order.customer_id === user.id;
      const isAssignedElectrician = order.electrician_id === user.id;
      if (!isCustomer && !isAssignedElectrician) {
        return json({ error: "You do not have access to this order." }, 403);
      }

      if (order.status !== "final_payment_pending") {
        return json({ error: "Order is not awaiting final payment." }, 409);
      }

      paymentCustomerId = order.customer_id;
      amount = Number(order.amount_due);
      if (!(amount > 0)) return json({ error: "No final amount is due." }, 400);
      orderNote = `BijliMitra final payment for ${orderId}`;

      // Same reasoning as above -- no reuse of a prior pending session.
      await admin.from("orders").update({
        final_payment_status: "pending",
        updated_at: new Date().toISOString(),
      }).eq("id", orderId);
    }

    const cashfreeOrderId = `BM_${paymentType === "booking_advance" ? "ADV" : "FINAL"}_${(orderId ?? user.id).replaceAll("-", "").slice(0, 20)}_${crypto.randomUUID().slice(0, 8)}`;
    const base = environment === "production" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com";
    const customerPhone = String(user.phone || "9999999999").replace(/\D/g, "").slice(-10) || "9999999999";

    const webhookUrl = `${supabaseUrl}/functions/v1/cashfree-webhook`;

    const cfBody: Record<string, unknown> = {
      order_id: cashfreeOrderId,
      order_currency: "INR",
      order_amount: amount,
      customer_details: {
        customer_id: paymentCustomerId,
        customer_email: user.email || "customer@bijlimitra.local",
        customer_phone: customerPhone,
      },
      order_note: orderNote,
      order_meta: {
        return_url: appUrl ? `${appUrl}/?cashfree_order_id={order_id}` : undefined,
        notify_url: webhookUrl,
      },
    };

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
      customer_id: paymentCustomerId,
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

    if (paymentType === "final_payment" && renderAs === "qrcode") {
      const qr = await requestUpiQr(base, cf.payment_session_id);
      if (!qr) {
        return json({ error: "Cashfree did not return a UPI QR payload for this order." }, 502);
      }
      return json({
        qr_payload: qr,
        cashfree_order_id: cf.order_id,
        payment_id: payment.id,
        amount,
      });
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

async function requestUpiQr(base: string, paymentSessionId: string): Promise<string | null> {
  const resp = await fetch(`${base}/pg/orders/sessions`, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "x-api-version": CASHFREE_VERSION,
    },
    body: JSON.stringify({
      payment_session_id: paymentSessionId,
      payment_method: { upi: { channel: "qrcode" } },
    }),
  });

  const text = await resp.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!resp.ok) {
    console.error("Cashfree Order Pay (qrcode) failed", data);
    return null;
  }

  const candidate =
    data?.data?.payload?.qrcode ??
    data?.data?.payload?.default ??
    data?.data?.payload?.upi_qr ??
    data?.data?.url ??
    data?.qr_code ??
    null;

  if (!candidate || typeof candidate !== "string") {
    console.error("Cashfree Order Pay (qrcode) response had no recognizable QR payload", data);
    return null;
  }

  return candidate;
}