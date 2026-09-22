-- ==========================================================
-- U-39 CONCEPT — edição em nuvem para todos os dispositivos
-- Execute este arquivo UMA VEZ no Supabase SQL Editor.
-- Depois substitua SEU_EMAIL_ADMIN@EXEMPLO.COM pelo e-mail
-- que será usado para entrar como administrador nos apps.
-- ==========================================================

create table if not exists public.u39_app_admins (
  app_slug text not null,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (app_slug, email)
);

create table if not exists public.u39_app_state (
  app_slug text not null,
  state_key text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  primary key (app_slug, state_key)
);

create or replace function public.is_app_admin(target_app text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.u39_app_admins a
    where a.app_slug = target_app
      and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email',''))
  );
$$;

grant execute on function public.is_app_admin(text) to anon, authenticated;

create or replace function public.is_app_admin_rpc(target_app text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_app_admin(target_app);
$$;

grant execute on function public.is_app_admin_rpc(text) to anon, authenticated;

create or replace function public.u39_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_u39_app_state_updated_at on public.u39_app_state;
create trigger trg_u39_app_state_updated_at
before update on public.u39_app_state
for each row execute function public.u39_touch_updated_at();

alter table public.u39_app_admins enable row level security;
alter table public.u39_app_state enable row level security;

grant select on public.u39_app_admins to authenticated;
grant select on public.u39_app_state to anon, authenticated;
grant insert, update, delete on public.u39_app_state to authenticated;

-- ADMIN table: nenhum usuário comum precisa listar e-mails dos administradores.
drop policy if exists "u39_admins_self_read" on public.u39_app_admins;
create policy "u39_admins_self_read"
on public.u39_app_admins for select
to authenticated
using (lower(email)=lower(coalesce(auth.jwt()->>'email','')));

-- Estado: leitura pública; gravação somente pelo administrador do app.
drop policy if exists "u39_state_public_read" on public.u39_app_state;
create policy "u39_state_public_read"
on public.u39_app_state for select
to anon, authenticated
using (true);

drop policy if exists "u39_state_admin_insert" on public.u39_app_state;
create policy "u39_state_admin_insert"
on public.u39_app_state for insert
to authenticated
with check (public.is_app_admin(app_slug));

drop policy if exists "u39_state_admin_update" on public.u39_app_state;
create policy "u39_state_admin_update"
on public.u39_app_state for update
to authenticated
using (public.is_app_admin(app_slug))
with check (public.is_app_admin(app_slug));

drop policy if exists "u39_state_admin_delete" on public.u39_app_state;
create policy "u39_state_admin_delete"
on public.u39_app_state for delete
to authenticated
using (public.is_app_admin(app_slug));

-- Bucket público para desenhos e vídeos. Escrita continua protegida por RLS.
insert into storage.buckets (id, name, public)
values ('u39-app-media', 'u39-app-media', true)
on conflict (id) do update set public = true;

drop policy if exists "u39_media_public_read" on storage.objects;
create policy "u39_media_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id='u39-app-media');

drop policy if exists "u39_media_admin_insert" on storage.objects;
create policy "u39_media_admin_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id='u39-app-media'
  and public.is_app_admin(split_part(name,'/',1))
);

drop policy if exists "u39_media_admin_update" on storage.objects;
create policy "u39_media_admin_update"
on storage.objects for update
to authenticated
using (
  bucket_id='u39-app-media'
  and public.is_app_admin(split_part(name,'/',1))
)
with check (
  bucket_id='u39-app-media'
  and public.is_app_admin(split_part(name,'/',1))
);

drop policy if exists "u39_media_admin_delete" on storage.objects;
create policy "u39_media_admin_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id='u39-app-media'
  and public.is_app_admin(split_part(name,'/',1))
);

-- Realtime: permite que páginas abertas recebam as alterações sem recarregar.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='u39_app_state'
  ) then
    alter publication supabase_realtime add table public.u39_app_state;
  end if;
end $$;

-- ==========================================================
-- DEFINA O ADMINISTRADOR AQUI
-- Troque o e-mail abaixo antes de executar o script.
-- O mesmo administrador ficará autorizado nos dois apps.
-- ==========================================================
insert into public.u39_app_admins (app_slug,email) values
('conversor-concept', 'SEU_EMAIL_ADMIN@EXEMPLO.COM'),
('secao-dispersao-concept', 'SEU_EMAIL_ADMIN@EXEMPLO.COM')
on conflict do nothing;
