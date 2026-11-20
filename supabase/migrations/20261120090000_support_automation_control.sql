alter table public.site_settings add column support_auto_reply boolean not null default true;
alter table public.support_messages add column auto_reply boolean;
