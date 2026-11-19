create function public.owner_live_website_analytics(report_days integer)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
 with recent as (
  (select e.created_at as occurred_at,e.kind,e.page,e.source
   from public.site_analytics_events e
   where e.created_at between now()-interval '15 minutes' and now()
   order by e.created_at desc limit 15)
  union all
  (select r.created_at,'part_request',null,null
   from public.part_requests r
   where r.created_at between now()-interval '15 minutes' and now()
   order by r.created_at desc limit 15)
  union all
  (select q.created_at,'quote_created',null,null
   from public.part_request_quotes q
   where q.created_at between now()-interval '15 minutes' and now()
   order by q.created_at desc limit 15)
  union all
  (select p.created_at,'registration',null,null
   from public.profiles p
   where p.created_at between now()-interval '15 minutes' and now()
   order by p.created_at desc limit 15)
  union all
  (select o.paid_at,'sale',null,null
   from public.orders o
   where o.paid_at between now()-interval '15 minutes' and now()
     and o.status in ('paid','shipped') and left(o.stripe_session_id,8)='cs_live_'
   order by o.paid_at desc limit 15)
 ), latest as (
  select occurred_at,kind,page,source
  from recent order by occurred_at desc,kind,page,source limit 15
 )
 select public.owner_website_analytics(report_days) || jsonb_build_object(
  'live',jsonb_build_object(
   'observed_at',now(),
   'active_sessions',(
    select count(distinct e.session_id)
    from public.site_analytics_events e
    where e.created_at between now()-interval '5 minutes' and now()
   ),
   'recent',coalesce(
    (select jsonb_agg(to_jsonb(l) order by l.occurred_at desc,l.kind,l.page,l.source) from latest l),
    '[]'::jsonb
   )
  )
 );
$$;

revoke all on function public.owner_live_website_analytics(integer) from public, anon, authenticated;
grant execute on function public.owner_live_website_analytics(integer) to service_role;
