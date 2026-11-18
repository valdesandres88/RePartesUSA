create table public.part_requests (
 id uuid primary key,
 vehicle_year integer not null check(vehicle_year between 1950 and 2100),
 make text not null check(char_length(make) between 2 and 60),
 model text not null check(char_length(model) between 1 and 80),
 part text not null check(char_length(part) between 3 and 150),
 details text not null default '' check(char_length(details)<=1000),
 contact_name text not null check(char_length(contact_name) between 2 and 80),
 email text not null check(char_length(email)<=254),
 phone text not null default '' check(char_length(phone)<=40),
 status text not null default 'new' check(status in ('new','reviewing','closed')),
 consented_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index part_requests_email_created on public.part_requests(email,created_at desc);
create index part_requests_created on public.part_requests(created_at desc);
alter table public.part_requests enable row level security;
revoke all on public.part_requests from public,anon,authenticated;
grant select,insert,update on public.part_requests to service_role;
