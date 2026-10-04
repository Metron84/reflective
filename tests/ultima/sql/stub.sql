-- Minimal Supabase stand-ins so the Ultima migrations apply on plain Postgres.
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid());
create function auth.uid() returns uuid language sql stable as 'select null::uuid';
