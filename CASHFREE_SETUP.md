
# Cashfree + Supabase Edge Functions

This project now includes:
- `supabase/functions/create-cashfree-payment`
- `supabase/functions/cashfree-webhook`
- Cashfree Web Checkout SDK in the React app.

Cashfree API version used: `2025-01-01`.

## 1. Deploy the functions

From the project root:

```bash
supabase login
supabase link --project-ref tqyenusqqptbusbkhlbh
supabase functions deploy create-cashfree-payment
supabase functions deploy cashfree-webhook
```

If your Supabase CLI asks for a project reference, use the ref from your project URL.

## 2. Set server secrets

Never put the Cashfree secret in a `VITE_` variable.

```bash
supabase secrets set \
  CASHFREE_CLIENT_ID="YOUR_CASHFREE_APP_ID" \
  CASHFREE_CLIENT_SECRET="YOUR_CASHFREE_SECRET_KEY" \
  CASHFREE_ENVIRONMENT="sandbox" \
  APP_URL="https://YOUR-FRONTEND-DOMAIN"
```

For local development, `APP_URL` can be your deployed frontend URL. Cashfree's webhook needs a reachable HTTPS URL.

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions.

## 3. Cashfree dashboard

Use the Payment Gateway API keys from the Cashfree sandbox environment.

Set the webhook/notify URL to:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/cashfree-webhook`

Subscribe to payment success/failure events for Payment Gateway.

Cashfree webhook signatures are verified using `x-webhook-signature` and `x-webhook-timestamp`.

## 4. Frontend

Copy `.env.example` to `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_CASHFREE_ENVIRONMENT=sandbox
```

Then:

```bash
npm install
npm run dev
```

## 5. Important payment flow

Booking:
1. Customer creates order.
2. Database creates a pending booking payment for ₹21.
3. Frontend calls `create-cashfree-payment`.
4. Edge Function validates ownership and amount.
5. Edge Function creates Cashfree order.
6. Cashfree checkout opens.
7. Cashfree webhook verifies signature.
8. Payment is marked successful.
9. Order advance status becomes `paid`.
10. `generate_order_pins()` is invoked.

Final:
1. Customer confirms final bill.
2. Electrician verifies completed PIN.
3. Order reaches `final_payment_pending`.
4. Customer checkout is created for `orders.amount_due`.
5. Cashfree webhook verifies success.
6. `complete_order_after_payment()` is invoked.
7. Order becomes completed and electrician becomes available.

## Security

- Cashfree secret is server-only.
- Browser never sends Cashfree credentials.
- Edge Function validates the authenticated Supabase user.
- Edge Function checks order ownership.
- Booking amount is forced to the database's ₹21 advance amount.
- Final amount is taken from `orders.amount_due`, not from browser input.
- Webhook signature is verified before database changes.
- Duplicate pending checkout orders are reused when possible.

## Note on final QR

This version opens Cashfree Web Checkout for final payment. If the product requirement is specifically a Cashfree UPI QR rendered inside the electrician console, that is a separate Cashfree QR/API flow and should be wired after confirming the exact QR product enabled on the merchant account.
