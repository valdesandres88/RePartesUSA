alter table public.part_requests
  add column zip_code text
  constraint part_requests_zip_code_format check (zip_code ~ '^[0-9]{5}$');
