create table public.site_analytics_events (
 id uuid primary key,
 session_id uuid not null,
 page text not null check (page in ('home','catalog','part','quotes','login','sell','orders','return','review','feedback','referrals','about','contact','shipping','privacy','terms','advertising','guide_en','guide_es')),
 kind text not null check (kind in ('view','search','oem_search','no_results','ebay_click','partner_click','quote_open')),
 source text not null check (source in ('direct','google','bing','tiktok','facebook','instagram','threads','x','telegram','youtube','pinterest','reddit','email','other')),
 device text not null check (device in ('mobile','desktop')),
 created_at timestamptz not null default now()
);

create index site_analytics_events_created on public.site_analytics_events(created_at);
alter table public.site_analytics_events enable row level security;
revoke all on public.site_analytics_events from public, anon, authenticated;
grant select, insert, delete on public.site_analytics_events to service_role;

create function public.owner_website_analytics(report_days integer)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
 with settings as (
  select (now() at time zone 'America/New_York')::date as today,
         case when report_days in (7,30,90) then report_days else 7 end as days
 ), bounds as (
  select today, today-days+1 as start_day,
         (today-days+1)::timestamp at time zone 'America/New_York' as since
  from settings
 ), events as materialized (
  select e.session_id,e.page,e.kind,e.source,e.device,e.created_at
  from public.site_analytics_events e, bounds b
  where e.created_at >= b.since and e.created_at <= now()
 ), views as materialized (
  select * from events where kind='view'
 ), daily as (
  select (created_at at time zone 'America/New_York')::date as day,
         count(*) filter (where kind='view') as views,count(distinct session_id) as visits
  from events group by 1
 ), calendar as (
  select b.start_day+n as day
  from bounds b cross join lateral generate_series(0,b.today-b.start_day) as series(n)
 ), pages as (
  select page,count(*) as views from views group by page
 ), traffic as (
  select source,count(distinct session_id) as visits from events group by source
 ), devices as (
  select device,count(distinct session_id) as visits from events group by device
 ), activity as (
  select kind,count(*) as events from events where kind<>'view' group by kind
 ), sales as (
  select count(*) as orders,coalesce(sum(amount_cents),0) as gross_cents,
         coalesce(sum(platform_fee_cents),0) as fee_cents
  from public.orders,bounds
  where paid_at>=since and paid_at<=now()
    and status in ('paid','shipped') and left(stripe_session_id,8)='cs_live_'
 )
 select jsonb_build_object(
  'visits',(select count(distinct session_id) from events),
  'views',(select count(*) from views),
  'daily',(select jsonb_agg(jsonb_build_object('day',c.day,'views',coalesce(d.views,0),'visits',coalesce(d.visits,0)) order by c.day)
           from calendar c left join daily d using(day)),
  'pages',coalesce((select jsonb_agg(to_jsonb(p) order by p.views desc,p.page) from pages p),'[]'::jsonb),
  'sources',coalesce((select jsonb_agg(to_jsonb(t) order by t.visits desc,t.source) from traffic t),'[]'::jsonb),
  'devices',coalesce((select jsonb_agg(to_jsonb(d) order by d.visits desc,d.device) from devices d),'[]'::jsonb),
  'activity',coalesce((select jsonb_object_agg(kind,events) from activity),'{}'::jsonb),
  'requests',(select count(*) from public.part_requests,bounds where created_at>=since and created_at<=now()),
  'quotes',(select count(*) from public.part_request_quotes,bounds where created_at>=since and created_at<=now()),
  'registrations',(select count(*) from public.profiles,bounds where created_at>=since and created_at<=now()),
  'sales',(select to_jsonb(s) from sales s)
 );
$$;

revoke all on function public.owner_website_analytics(integer) from public, anon, authenticated;
grant execute on function public.owner_website_analytics(integer) to service_role;
