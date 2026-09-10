import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey && !url.includes("YOUR_PROJECT"));

export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

export async function currentUser() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export async function signIn(email, password) {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email, password, fullName, phone, role = "customer") {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone, role } }
  });
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function getServices() {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getLocations(userId) {
  const { data, error } = await supabase
    .from("service_locations")
    .select("*")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addLocation(userId, form) {
  const { data, error } = await supabase
    .from("service_locations")
    .insert({ customer_id: userId, ...form })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getCustomerOrders(userId) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getOrderItems(orderId) {
  const { data, error } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function getOrderHistory(orderId) {
  const { data, error } = await supabase
    .from("order_status_history")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

// Plaintext start/completed PINs -- only ever readable by the order's own
// customer (RLS-enforced). Returns null if the electrician hasn't accepted
// the order yet (PINs are generated on booking-payment success, but this
// still guards against a not-yet-generated or not-yours case cleanly).
export async function getOrderPins(orderId) {
  const { data, error } = await supabase
    .from("order_pins")
    .select("start_pin, completed_pin")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function createCustomerOrder(userId, locationId, items) {
  const { data, error } = await supabase.rpc("create_customer_order", {
    p_customer_id: userId,
    p_service_location_id: locationId,
    p_items: items
  });
  if (error) throw error;
  return data;
}

export async function createBookingPayment(orderId, userId) {
  const { data, error } = await supabase.rpc("create_booking_payment", {
    p_order_id: orderId,
    p_customer_id: userId
  });
  if (error) throw error;
  return data;
}

export async function confirmFinalBill(orderId, userId) {
  const { data, error } = await supabase.rpc("confirm_final_bill", {
    p_order_id: orderId,
    p_customer_id: userId
  });
  if (error) throw error;
  return data;
}

export async function getPendingOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "pending")
    .eq("advance_payment_status", "paid")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getElectricianProfile(userId) {
  const { data, error } = await supabase
    .from("electrician_profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function getAssignedOrders(userId) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("electrician_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function acceptOrder(orderId, userId) {
  const { data, error } = await supabase.rpc("accept_order", {
    p_order_id: orderId,
    p_electrician_id: userId
  });
  if (error) throw error;
  return data;
}

export async function startOrderWork(orderId, pin) {
  const { data, error } = await supabase.rpc("start_order_work", {
    p_order_id: orderId,
    p_pin: pin
  });
  if (error) throw error;
  return data;
}

export async function addTechnicianService(orderId, electricianId, serviceId, quantity) {
  const { data, error } = await supabase.rpc("add_technician_service", {
    p_order_id: orderId,
    p_electrician_id: electricianId,
    p_service_id: serviceId,
    p_quantity: quantity
  });
  if (error) throw error;
  return data;
}

export async function removeTechnicianService(orderId, electricianId, orderItemId) {
  const { data, error } = await supabase.rpc("remove_technician_service", {
    p_order_id: orderId,
    p_electrician_id: electricianId,
    p_order_item_id: orderItemId
  });
  if (error) throw error;
  return data;
}

export async function generateFinalBill(orderId, electricianId) {
  const { data, error } = await supabase.rpc("generate_final_bill", {
    p_order_id: orderId,
    p_electrician_id: electricianId
  });
  if (error) throw error;
  return data;
}

export async function verifyCompletedPin(orderId, electricianId, pin) {
  const { data, error } = await supabase.rpc("verify_completed_pin", {
    p_order_id: orderId,
    p_electrician_id: electricianId,
    p_pin: pin
  });
  if (error) throw error;
  return data;
}

/**
 * Cashfree:
 * The secret key must NEVER be used in this file.
 * Create an Edge Function such as "create-cashfree-payment"
 * and call it here when you are ready.
 */
async function invokeFunction(name, body) {
  if (!supabase) throw new Error("Supabase is not configured.");

  // Proactively refresh the session before every call that needs auth. A
  // final payment can happen much later than the customer's last active
  // interaction (after the whole electrician visit), so the token they
  // logged in with may have gone stale by then. getSession() refreshes it
  // if needed and returns the current one either way.
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error("Your session has expired. Please log in again and retry.");
  }

  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` }
  });

  if (error) {
    // supabase-js only gives a generic "non-2xx status code" message by
    // default -- the real reason is in the response body, which we have to
    // unwrap manually.
    let detail = null;
    try { detail = (await error.context?.json?.())?.error; } catch { /* ignore */ }
    throw new Error(detail || error.message || "Request failed.");
  }

  return data;
}

async function openCashfreeCheckout(body) {
  const data = await invokeFunction("create-cashfree-payment", body);
  if (!data?.payment_session_id) throw new Error("Cashfree payment session was not returned.");

  if (!window.Cashfree) throw new Error("Cashfree Checkout SDK is not loaded.");
  const cashfree = window.Cashfree({
    mode: import.meta.env.VITE_CASHFREE_ENVIRONMENT === "production" ? "production" : "sandbox"
  });

  return cashfree.checkout({
    paymentSessionId: data.payment_session_id,
    redirectTarget: "_modal"
  });
}

/**
 * Booking flow: no order exists yet. The cart (location + items) is sent
 * straight to Cashfree; the real order only gets created by the webhook
 * once this ₹21 payment actually succeeds.
 */
export async function startCashfreeBookingCheckout(locationId, items) {
  return openCashfreeCheckout({
    payment_type: "booking_advance",
    service_location_id: locationId,
    items
  });
}

export async function startCashfreeFinalCheckout(orderId) {
  return openCashfreeCheckout({ payment_type: "final_payment", order_id: orderId });
}

/**
 * In-person UPI QR flow for the electrician console: instead of opening
 * the Cashfree Checkout modal, this asks the backend for a UPI QR payload
 * (via Cashfree's Order Pay API, channel "qrcode") and renders it as an
 * actual scannable QR code image (data URL) using the `qrcode` library
 * loaded in index.html. The customer scans it with their own UPI app.
 */
export async function createFinalPaymentQr(orderId) {
  const data = await invokeFunction("create-cashfree-payment", { payment_type: "final_payment", order_id: orderId, render_as: "qrcode" });
  if (!data?.qr_payload) throw new Error("Cashfree did not return a QR code for this order.");

  // Cashfree can return either a short UPI deep-link (upi://pay?...), which
  // we need to render into a QR code ourselves, OR an already-rendered QR
  // image as a base64 data URL -- in which case we just use it directly.
  // Trying to re-encode an already-huge image string into a new QR code is
  // what caused "data is too big to be stored in a QR Code".
  const payload = data.qr_payload;
  const qrImageDataUrl = payload.startsWith("data:image")
    ? payload
    : await QRCode.toDataURL(payload, { width: 260, margin: 1 });

  return {
    qrImageDataUrl,
    amount: data.amount,
    cashfreeOrderId: data.cashfree_order_id,
    cfPaymentId: data.cf_payment_id,
    isSandbox: data.environment !== "production",
  };
}

/**
 * Cash payment: the electrician received the remaining amount in person
 * and taps this to close the order out directly -- no Cashfree involved
 * at all. Records a payment row (payment_method: "cash") and runs the
 * order through the exact same completion path a Cashfree payment would.
 */
export async function recordCashPayment(orderId, electricianId) {
  const { data, error } = await supabase.rpc("complete_order_with_cash_payment", {
    p_order_id: orderId,
    p_electrician_id: electricianId
  });
  if (error) throw error;
  return data;
}