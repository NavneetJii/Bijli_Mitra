# BijliMitra Frontend — v0.1

React + Vite frontend for the BijliMitra electrician booking platform.

## Included

### Customer
- Supabase Auth sign up/sign in
- Customer account
- Saved service locations
- Multiple service selection and quantity
- ₹121 compulsory inspection/minimum fee
- ₹21 non-refundable booking token
- Token shown as deduction from the final/due amount
- Customer order list
- Order status/timeline
- Customer-side order items
- Final bill review and confirmation
- Work-status lifecycle UI

### Electrician
- Pending confirmed bookings
- One active order at a time
- Assigned-order list
- Availability display
- Work Start PIN
- Technician-added services with quantity
- Final bill generation
- Work Completed PIN
- Final-payment-pending state

## Pricing

The service catalogue is read from `public.services` when Supabase is configured.
A fallback catalogue is included for UI preview:

- Switch / Socket Replacement — ₹49/piece
- Ceiling / Wall / Exhaust Fan Installation — ₹199/fan
- Light Fitting — ₹99/light
- Chandelier (Jhoomar) Installation — ₹499
- MCB Replacement — ₹75/unit
- Inverter & Battery Complete Setup — ₹449
- Geyser Electrical Fitting — ₹299
- Water Motor / Starter Wiring — ₹349
- New Point Wiring — ₹199/point
- Power Point Wiring — ₹299/point
- Fault Finding / Short Circuit Checking — ₹299

Inspection fee: ₹121
Booking token: ₹21

## Supabase

Copy `.env.example` to `.env` and set:

VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

The browser only uses the public anon key.

## Cashfree

Cashfree secret credentials are NOT included in the frontend.

The frontend calls the future Edge Function:

`create-cashfree-payment`

The Edge Function should:
1. Authenticate the current user.
2. Validate order ownership and payment type.
3. Create the Cashfree payment/order.
4. Return a payment session ID.
5. Cashfree webhook verifies payment server-side.
6. Server-side function confirms the ₹21 booking payment or final payment.

Do not place `x-client-secret` in `.env` with a VITE_ prefix.

## Run

npm install
npm run dev

## Important

The current UI is intentionally the first frontend layer. Cashfree checkout UI and the final QR-payment implementation require the Edge Functions/webhook work next.


## Cashfree integration

Cashfree Web Checkout SDK and Supabase Edge Functions are included. See `CASHFREE_SETUP.md`. The Cashfree secret is never included in the frontend.
