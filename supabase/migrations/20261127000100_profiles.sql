begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  nick text not null default '' check (length(nick) <= 40),
  avatar text not null default '' check (
    octet_length(avatar) <= 131072 and
    (avatar = '' or avatar ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+=*$')
  )
);

alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select, update (name, nick, avatar) on public.profiles to authenticated;
create policy read_own_profile on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy update_own_profile on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create schema if not exists private;
create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, name, nick)
  values (new.id, coalesce(nullif(left(trim(new.raw_user_meta_data->>'name'),60),''),'Пользователь'),
          left(coalesce(new.raw_user_meta_data->>'nick',''),40));
  return new;
end;
$$;
revoke all on function private.create_profile() from public, anon, authenticated;
create trigger create_profile after insert on auth.users
  for each row execute function private.create_profile();
insert into public.profiles(id,name,nick)
select id, coalesce(nullif(left(trim(raw_user_meta_data->>'name'),60),''),'Пользователь'),
       left(coalesce(raw_user_meta_data->>'nick',''),40)
from auth.users on conflict (id) do nothing;
commit;
