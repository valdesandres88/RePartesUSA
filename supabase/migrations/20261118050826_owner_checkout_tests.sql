create table public.checkout_tests (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references public.profiles(id),
 amount_cents integer not null default 1000 check(amount_cents=1000),
 status text not null default 'created' check(status in ('created','open','paid','expired','refund_pending','refunded')),
 stripe_session_id text unique,
 stripe_payment_intent_id text unique,
 stripe_refund_id text unique,
 paid_webhook_at timestamptz,
 refund_webhook_at timestamptz,
 created_at timestamptz not null default now()
);
create index checkout_tests_creator_created on public.checkout_tests(creator_id,created_at desc);
alter table public.checkout_tests enable row level security;
revoke all on public.checkout_tests from public,anon,authenticated;
grant select,insert,update on public.checkout_tests to service_role;
