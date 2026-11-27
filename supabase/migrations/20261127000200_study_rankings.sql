begin;

create table private.study_answers (
  owner uuid not null references public.profiles(id) on delete cascade,
  run_id uuid not null,
  question integer not null check (question between 0 and 10000),
  study_day date not null,
  written boolean not null,
  correct boolean not null,
  primary key (owner,run_id,question)
);
revoke all on private.study_answers from public, anon, authenticated;

create function public.submit_study_answers(account uuid, answers jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare inserted integer;
begin
  if auth.uid() is null or auth.uid() <> account then raise insufficient_privilege; end if;
  if jsonb_typeof(answers) <> 'array' or jsonb_array_length(answers) > 100 then
    raise exception 'Invalid batch';
  end if;
  insert into private.study_answers (owner,run_id,question,study_day,written,correct)
    select auth.uid(), a.run_id,a.question,a.study_day,a.written,a.correct
    from jsonb_to_recordset(answers) as a(run_id uuid,question integer,study_day date,written boolean,correct boolean)
    on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create view private.study_totals as
with daily as (
  select owner,study_day,count(*) as attempts,
    count(*) filter (where written and correct) as recipes,
    count(*) filter (where not correct) as mistakes
  from private.study_answers group by owner,study_day
), clean_days as (
  select owner,study_day - (row_number() over (partition by owner order by study_day))::int as period
  from daily where mistakes=0
), streaks as (
  select owner,count(*) as days from clean_days group by owner,period
)
select owner,sum(attempts)::bigint as attempts,sum(recipes)::bigint as recipes,sum(mistakes)::bigint as mistakes,
  coalesce((select max(days) from streaks where streaks.owner=daily.owner),0) as streak
from daily group by owner;
revoke all on private.study_totals from public, anon, authenticated;

create function public.my_study_stats() returns table(recipes bigint,streak bigint,mistakes bigint)
language sql stable security definer set search_path = '' as $$
  select recipes,streak,mistakes from private.study_totals where owner=auth.uid();
$$;

create function public.study_leaderboard(metric text, start_at integer default 0)
returns table(display_name text, score bigint, mine boolean)
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(p.nick,''),p.name),v.score,coalesce(t.owner=auth.uid(),false)
  from private.study_totals t join public.profiles p on p.id=t.owner
  cross join lateral (select case metric when 'recipes' then t.recipes when 'streak' then t.streak when 'mistakes' then t.mistakes end as score) v
  where v.score>0 or metric='mistakes'
  order by case when metric='mistakes' then v.score else -v.score end,t.attempts desc,t.owner
  limit 21 offset greatest(start_at,0);
$$;

revoke all on function public.submit_study_answers(uuid,jsonb), public.my_study_stats(), public.study_leaderboard(text,integer) from public, anon, authenticated;
grant execute on function public.submit_study_answers(uuid,jsonb), public.my_study_stats() to authenticated;
grant execute on function public.study_leaderboard(text,integer) to anon, authenticated;
commit;
