create table public.write_essay_items (
  id bigint generated always as identity primary key,
  slug text unique not null,
  title text not null,
  prompt text not null,
  planning_points jsonb not null,
  difficulty text not null,
  source_type text not null,
  source_ref text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active boolean not null default true,
  constraint write_essay_items_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint write_essay_items_title_nonempty_check
    check (btrim(title) <> ''),
  constraint write_essay_items_prompt_nonempty_check
    check (btrim(prompt) <> ''),
  constraint write_essay_items_difficulty_nonempty_check
    check (btrim(difficulty) <> ''),
  constraint write_essay_items_source_type_nonempty_check
    check (btrim(source_type) <> ''),
  constraint write_essay_items_created_by_nonempty_check
    check (btrim(created_by) <> ''),
  constraint write_essay_items_updated_by_nonempty_check
    check (btrim(updated_by) <> ''),
  constraint write_essay_items_difficulty_format_check
    check (difficulty ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint write_essay_items_source_type_format_check
    check (source_type ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint write_essay_items_planning_points_array_check
    check (
      jsonb_typeof(planning_points) = 'array'
      and jsonb_array_length(planning_points) between 3 and 5
    )
);

alter table public.write_essay_items enable row level security;

revoke all privileges on table public.write_essay_items from anon, authenticated;
grant select on table public.write_essay_items to anon, authenticated;

create policy "write_essay_items_public_read_active"
  on public.write_essay_items
  for select
  to anon, authenticated
  using (active = true);
