-- Preserve payment adjustments independently of webhook order or retries.
create table public.referral_payment_events (
 event_id text primary key,
 intent text not null,
 kind text not null check (kind in ('refund','dispute_open','dispute_won','dispute_lost')),
 refunded_fee integer not null default 0 check (refunded_fee >= 0),
 full_refund boolean not null default false,
 dispute_id text
);
create index referral_payment_events_intent_idx on public.referral_payment_events(intent);
alter table public.referral_payment_events enable row level security;
revoke all on public.referral_payment_events from public, anon, authenticated;
grant select,insert,update on public.referral_payment_events to service_role;

create view public.referral_earnings with (security_invoker=true) as
select r.referrer_id,r.referred_id,r.code,r.created_at,
 o.id is not null as qualified,
 case when s.state='Canceled' then 0 else
 round(greatest(0,o.platform_fee_cents-coalesce(adj.fee,0))*0.10)::int end as reward_cents,
 s.state, o.delivered_at+31 as available_on
from public.referrals r
left join lateral (
 select x.* from public.orders x where x.buyer_id=r.referred_id
 and x.paid_at is not null and left(x.stripe_session_id,8)='cs_live_'
 order by x.paid_at,x.id limit 1
) o on true
left join public.return_requests ret on ret.order_id=o.id
left join lateral (
 select max(e.refunded_fee) as fee,bool_or(e.full_refund or e.kind='dispute_lost') as canceled,
 bool_or(e.kind='dispute_open' and not exists(select 1 from public.referral_payment_events resolved
 where resolved.intent=e.intent and resolved.dispute_id=e.dispute_id and resolved.kind='dispute_won')) as disputed
 from public.referral_payment_events e where e.intent=o.stripe_payment_intent_id
) adj on true
cross join lateral (select case
 when o.id is null then 'Registered'
 when o.paid_at<r.created_at or o.status='refunded' or adj.canceled or ret.status='refunded' then 'Canceled'
 when coalesce(o.platform_fee_cents,0)<=coalesce(adj.fee,0) then 'No commission'
 when adj.disputed or ret.status is not null and ret.status<>'rejected' then 'On hold'
 when o.delivered_at is null or (now() at time zone 'UTC')::date <= o.delivered_at+30 then 'Pending'
 else 'Earned' end as state) s;
revoke all on public.referral_earnings from public,anon,authenticated;
grant select on public.referral_earnings to service_role;

create function public.referral_balance(p_referrer uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('invites',count(*),'qualified',count(*) filter(where qualified),
 'pending_cents',coalesce(sum(reward_cents) filter(where state in ('Pending','On hold')),0),
 'earned_cents',coalesce(sum(reward_cents) filter(where state='Earned'),0))
 from public.referral_earnings where referrer_id=p_referrer
$$;
revoke all on function public.referral_balance(uuid) from public,anon,authenticated;
grant execute on function public.referral_balance(uuid) to service_role;
