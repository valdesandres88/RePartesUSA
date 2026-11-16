-- RePartes USA: referencia para instalaciones NUEVAS de Supabase.
-- NO ejecutar otra vez en RePartes USA ya configurado: las tablas y funciones están creadas.
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 is_banned boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.sellers (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 shop_name text not null check(char_length(shop_name) between 2 and 100),
 status text not null default 'pending' check(status in ('pending','approved','suspended')),
 stripe_account_id text unique,created_at timestamptz not null default now()
);
create table public.listings (
 id uuid primary key default gen_random_uuid(),
 seller_id uuid not null references public.sellers(user_id),
 title text not null check(char_length(title) between 5 and 140),
 description text not null check(char_length(description) between 15 and 4000),
 make text not null,model text not null,
 year_min int not null check(year_min between 1950 and 2100),
 year_max int not null check(year_max between 1950 and 2100),
 part_number text not null default '',
 condition text not null check(condition in ('used','remanufactured','new')),
 price_cents int not null check(price_cents between 1000 and 10000000),
 image_url text not null default '',
 status text not null default 'pending' check(status in ('pending','approved','rejected','reserved','sold','removed')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint years_ordered check(year_max>=year_min)
);
create index listings_status_idx on public.listings(status,created_at desc);
create index listings_seller_idx on public.listings(seller_id,created_at desc);
create table public.orders (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.listings(id),
 buyer_id uuid not null references public.profiles(id),
 seller_id uuid not null references public.sellers(user_id),
 amount_cents int not null,platform_fee_cents int not null,
 constraint order_amount_and_fee_valid check(amount_cents between 1000 and 10000000 and platform_fee_cents between 0 and amount_cents),
 status text not null default 'reserved' check(status in ('reserved','paid','shipped','expired','refunded')),
 stripe_session_id text unique,stripe_payment_intent_id text unique,
 shipping_info jsonb,tracking_code text,
 created_at timestamptz not null default now(),
 paid_at timestamptz,shipped_at timestamptz,refunded_at timestamptz
);
create index orders_created_idx on public.orders(created_at desc);
create table public.site_settings (
 id int primary key default 1 check(id=1),
 hero_title text not null default 'Encuentra la pieza que necesitas.',
 hero_subtitle text not null default 'Piezas automotrices de vendedores independientes en Estados Unidos.',
 announcement text not null default 'Marketplace de autopartes usadas · USA',
 commission_bps int not null default 1500 check(commission_bps between 500 and 3000),
 payments_enabled boolean not null default false,
 support_email text not null default '',
 updated_at timestamptz not null default now()
);
insert into public.site_settings(id) values(1);
create table public.audit_log (
 id bigint generated always as identity primary key,
 actor_id uuid,action text not null,target_id text,
 details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
create or replace function public.after_signup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,display_name)
 values(new.id,coalesce(new.raw_user_meta_data->>'display_name',''))
 on conflict do nothing;return new;
end; $$;
create trigger trg_new_user after insert on auth.users
for each row execute procedure public.after_signup();
alter table public.profiles enable row level security;
alter table public.sellers enable row level security;
alter table public.listings enable row level security;
alter table public.orders enable row level security;
alter table public.site_settings enable row level security;
alter table public.audit_log enable row level security;
revoke all on public.profiles,public.sellers,public.listings,public.orders,public.site_settings,public.audit_log from anon,authenticated;
grant select on public.listings,public.site_settings to anon,authenticated;
grant all on public.profiles,public.sellers,public.listings,public.orders,public.site_settings,public.audit_log to service_role;
grant usage,select on sequence public.audit_log_id_seq to service_role;
create policy "approved listings" on public.listings for select to anon,authenticated using(status='approved');
create policy "public config" on public.site_settings for select to anon,authenticated using(true);
create or replace function public.reserve_one(p_listing uuid,p_buyer uuid,p_fee_bps int)
returns uuid language plpgsql security definer set search_path='' as $$
declare l public.listings%rowtype;o_id uuid;
begin
 select * into l from public.listings where id=p_listing for update;
 if not found or l.status<>'approved' then raise exception 'PIEZA_NO_DISPONIBLE';end if;
 if l.seller_id=p_buyer then raise exception 'NO_COMPRA_PROPIA';end if;
 if p_fee_bps<500 or p_fee_bps>3000 then raise exception 'INVALID_FEE';end if;
 insert into public.orders(listing_id,buyer_id,seller_id,amount_cents,platform_fee_cents)
 values(l.id,p_buyer,l.seller_id,l.price_cents,round(l.price_cents*p_fee_bps/10000.0)::int) returning id into o_id;
 update public.listings set status='reserved',updated_at=now() where id=l.id;
 return o_id;
end; $$;
create or replace function public.order_paid(p_order uuid,p_session text,p_intent text,p_shipping jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;changed_id uuid;
begin
 select * into o from public.orders where id=p_order for update;
 if not found then raise exception 'ORDER_NOT_FOUND';end if;
 if p_session is null or p_session='' or p_intent !~ '^pi_[A-Za-z0-9]+$' then raise exception 'INVALID_STRIPE_IDS';end if;
 if o.stripe_session_id is distinct from p_session then raise exception 'STRIPE_SESSION_MISMATCH';end if;
 if o.status in ('paid','shipped','refunded') then
   if o.stripe_payment_intent_id is distinct from p_intent then raise exception 'STRIPE_PAYMENT_MISMATCH';end if;
   return;
 end if;
 if o.status<>'reserved' then raise exception 'ORDER_NOT_RESERVED';end if;
 update public.listings set status='sold',updated_at=now()
 where id=o.listing_id and status='reserved' returning id into changed_id;
 if changed_id is null then raise exception 'LISTING_NOT_RESERVED';end if;
 update public.orders set status='paid',stripe_payment_intent_id=p_intent,shipping_info=p_shipping,paid_at=now() where id=p_order;
end; $$;
create or replace function public.order_expire(p_order uuid)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;
begin
 select * into o from public.orders where id=p_order for update;
 if not found or o.status<>'reserved' then return;end if;
 update public.orders set status='expired' where id=p_order;
 update public.listings set status='approved',updated_at=now()
 where id=o.listing_id and status='reserved';
end; $$;
create or replace function public.order_refunded(p_order uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.orders set status='refunded',refunded_at=now() where id=p_order and status in ('paid','shipped');
end; $$;
create or replace function public.owner_metrics()
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object(
  'gross_cents',coalesce((select sum(amount_cents) from public.orders where status in ('paid','shipped')),0),
  'commission_cents',coalesce((select sum(platform_fee_cents) from public.orders where status in ('paid','shipped')),0),
  'orders_paid',(select count(*) from public.orders where status in ('paid','shipped')),
  'orders_refunded',(select count(*) from public.orders where status='refunded'),
  'listings_active',(select count(*) from public.listings where status='approved'),
  'listings_pending',(select count(*) from public.listings where status='pending'),
  'sellers_pending',(select count(*) from public.sellers where status='pending'),
  'sellers_total',(select count(*) from public.sellers),
  'buyers_total',(select count(*) from public.profiles)
 );$$;
revoke execute on function public.after_signup() from public,anon,authenticated;
revoke execute on function public.reserve_one(uuid,uuid,int),public.order_paid(uuid,text,text,jsonb),public.order_expire(uuid),public.order_refunded(uuid),public.owner_metrics() from public,anon,authenticated;
grant execute on function public.reserve_one(uuid,uuid,int),public.order_paid(uuid,text,text,jsonb),public.order_expire(uuid),public.order_refunded(uuid),public.owner_metrics() to service_role;
