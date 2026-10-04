create table public.summarize_written_text_items (
  id bigint generated always as identity primary key,
  slug text unique not null,
  title text not null,
  passage text not null,
  key_points jsonb not null,
  difficulty text not null,
  source_type text not null,
  source_ref text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active boolean not null default true,
  constraint summarize_written_text_items_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint summarize_written_text_items_title_nonempty_check
    check (btrim(title) <> ''),
  constraint summarize_written_text_items_passage_nonempty_check
    check (btrim(passage) <> ''),
  constraint summarize_written_text_items_difficulty_nonempty_check
    check (btrim(difficulty) <> ''),
  constraint summarize_written_text_items_source_type_nonempty_check
    check (btrim(source_type) <> ''),
  constraint summarize_written_text_items_created_by_nonempty_check
    check (btrim(created_by) <> ''),
  constraint summarize_written_text_items_updated_by_nonempty_check
    check (btrim(updated_by) <> ''),
  constraint summarize_written_text_items_difficulty_format_check
    check (difficulty ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint summarize_written_text_items_source_type_format_check
    check (source_type ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint summarize_written_text_items_key_points_array_check
    check (
      jsonb_typeof(key_points) = 'array'
      and jsonb_array_length(key_points) between 2 and 5
    )
);

alter table public.summarize_written_text_items enable row level security;

revoke all privileges on table public.summarize_written_text_items from anon, authenticated;
grant select on table public.summarize_written_text_items to anon, authenticated;

create policy "summarize_written_text_items_public_read_active"
  on public.summarize_written_text_items
  for select
  to anon, authenticated
  using (active = true);
