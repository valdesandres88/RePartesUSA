# Real external affiliate inventory

The part finder searches approved seller listings and published partner offers. Text matching is not fitment verification. Curated affiliate offers do not become seller inventory, and no prices or photos are scraped from Amazon.

The eBay Browse adapter is implemented but disabled until actual production access is approved and configured. There are no public demo items and no sandbox fallback. It displays USD fixed-price results from the production Browse API, preserves each returned itemAffiliateWebUrl, and labels checkout as external. The provider controls availability, shipping, taxes and returns. Commissions are only for qualifying purchases under the affiliate agreement.

## Activation prerequisites
1. Register RePartes USA with https://partnernetwork.ebay.com/ and obtain approval.
2. Follow https://developer.ebay.com/api-docs/buy/static/buy-requirements.html for the applicable Buy API production approval process.
3. Add production EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, and EBAY_AFFILIATE_CAMPAIGN_ID to protected Netlify server-side environment variables. Never paste secrets into chat, frontend code or VITE_ variables.
4. Set EBAY_PRODUCTION_APPROVED=true only after eBay grants access. Redeploy.
5. Run a real part search. Verify prices, images, actual item URLs with tracking and provider status. Do not report it live until a production response succeeds.

GET /api/partner-search?q=... exposes sanitized results or explicit not_connected / unavailable states. Empty q reports readiness without upstream requests. Server-side token caching, 60-second bounded result caching and request timeouts reduce upstream calls. No query history or visitor contact details are sent to eBay, only the search text. Review provider call quotas and edge-level rate limiting before high-traffic launch.

The Owner dashboard shows configuration status, not API approval inferred from a key. Local seller checkout remains governed independently by the payment launch checklist.
