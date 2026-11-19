alter table public.part_requests
  add column quote_token uuid not null default gen_random_uuid() unique;

create table public.part_request_quotes (
  id uuid primary key,
  request_id uuid not null references public.part_requests(id) on delete cascade,
  seller_name text not null check (char_length(seller_name) between 2 and 100),
  total_cents integer not null check (total_cents between 1 and 99999999),
  condition text not null check (condition in ('new', 'used', 'remanufactured')),
  fulfillment text not null check (fulfillment in ('pickup', 'shipping')),
  fulfillment_details text not null check (char_length(fulfillment_details) between 2 and 180),
  availability text not null check (char_length(availability) between 2 and 120),
  warranty text not null check (char_length(warranty) between 2 and 160),
  part_number text not null default '' check (char_length(part_number) <= 80),
  fitment_notes text not null check (char_length(fitment_notes) between 2 and 500),
  photo_paths text[] not null check (cardinality(photo_paths) between 1 and 2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index part_request_quotes_request on public.part_request_quotes(request_id, total_cents);

alter table public.part_request_quotes enable row level security;
revoke all on public.part_request_quotes from public, anon, authenticated;
grant select, insert, update on public.part_request_quotes to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quote-photos', 'quote-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp']);
