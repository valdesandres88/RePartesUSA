# Payment launch

Customer purchases remain off until the private test and real inventory are ready.

## Private test

1. Keep `CHECKOUT_MODE=test`, a server-side test key, and the test webhook secret in Netlify.
2. Sign in as Owner and open the Owner Dashboard.
3. Select **Open private test checkout**. This creates a $10 test transaction, not a physical product.
4. Complete Stripe Checkout using test card `4242 4242 4242 4242`, a future expiry, and any test CVC. Use test address details. Never use a real card in this flow.
5. Return to Owner and refresh until the payment webhook is received.
6. Select **Refund test payment**, then refresh until the refund webhook is received.
7. Confirm **Payment and refund webhooks verified**. These records are separate from inventory, orders and sales totals.

This verifies the platform Checkout, refund API and signed event round trip. A connected seller sale with commission, transfer reversal, shipping and returns must also be checked before third-party sellers launch.

## Live configuration

After the test, securely replace the main Stripe key with a restricted live key with the permissions needed by Checkout, refunds and Connect. Configure the live webhook signing secret for `/api/stripe-webhook`, then set `CHECKOUT_MODE=live` and redeploy. Do not publish key values. No customer payments turn on until the Owner enables them.

## Real inventory

The seller must submit an original photo, title, description, make/model/year compatibility, condition, part number where known, price including shipping, and confirm they possess the item. The Owner verifies availability and the original photo before approval. External sellers must finish Stripe Connect. Do not substitute test items or affiliate products for real seller inventory.
