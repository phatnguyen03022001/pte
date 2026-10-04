create table public.reading_fill_in_blanks_items (
  id bigint generated always as identity primary key,
  slug text unique not null,
  title text not null,
  passage_template text not null,
  blanks jsonb not null,
  difficulty text not null,
  source_type text not null,
  source_ref text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active boolean not null default true,
  constraint reading_fill_in_blanks_items_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint reading_fill_in_blanks_items_title_nonempty_check
    check (btrim(title) <> ''),
  constraint reading_fill_in_blanks_items_passage_template_nonempty_check
    check (btrim(passage_template) <> ''),
  constraint reading_fill_in_blanks_items_difficulty_nonempty_check
    check (btrim(difficulty) <> ''),
  constraint reading_fill_in_blanks_items_source_type_nonempty_check
    check (btrim(source_type) <> ''),
  constraint reading_fill_in_blanks_items_created_by_nonempty_check
    check (btrim(created_by) <> ''),
  constraint reading_fill_in_blanks_items_updated_by_nonempty_check
    check (btrim(updated_by) <> ''),
  constraint reading_fill_in_blanks_items_difficulty_format_check
    check (difficulty ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint reading_fill_in_blanks_items_source_type_format_check
    check (source_type ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint reading_fill_in_blanks_items_blanks_array_check
    check (
      jsonb_typeof(blanks) = 'array'
      and jsonb_array_length(blanks) between 1 and 8
    )
);

alter table public.reading_fill_in_blanks_items enable row level security;

revoke all privileges on table public.reading_fill_in_blanks_items from anon, authenticated;
grant select on table public.reading_fill_in_blanks_items to anon, authenticated;

create policy "reading_fill_in_blanks_items_public_read_active"
  on public.reading_fill_in_blanks_items
  for select
  to anon, authenticated
  using (active = true);
