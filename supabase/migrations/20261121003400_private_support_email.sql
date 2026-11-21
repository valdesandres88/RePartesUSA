-- Keep the owner support address available only to the backend.
revoke select on table public.site_settings from public, anon, authenticated;
revoke select (support_email) on table public.site_settings from public, anon, authenticated;
grant select (
  id, hero_title, hero_subtitle, announcement, commission_bps, payments_enabled,
  updated_at, social_links, adsense_publisher_id, adsense_enabled,
  monetization_offers, support_auto_reply, auto_refunds
) on table public.site_settings to anon, authenticated;
