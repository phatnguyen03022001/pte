create table if not exists public.study_review_states (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text not null,
  card_state jsonb not null check (jsonb_typeof(card_state) = 'object'),
  due_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint study_review_states_pkey primary key (user_id, item_key),
  constraint study_review_states_item_key_check check (
    length(item_key) between 1 and 640
    and item_key !~ '[[:cntrl:]]'
  )
);

alter table public.study_review_states enable row level security;

revoke all on table public.study_review_states from public, anon, authenticated;
grant select, insert, update on table public.study_review_states to authenticated;

create policy "Users can select their own review states"
  on public.study_review_states
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can insert their own review states"
  on public.study_review_states
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update their own review states"
  on public.study_review_states
  for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
