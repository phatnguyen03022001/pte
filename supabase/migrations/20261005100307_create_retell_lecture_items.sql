create table public.retell_lecture_items (
  id bigint generated always as identity primary key,
  slug text unique not null,
  title text not null,
  lecture_text text not null,
  review_points text[] not null,
  difficulty text not null,
  source_type text not null,
  source_ref text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active boolean not null default true,
  constraint retell_lecture_items_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint retell_lecture_items_title_nonempty_check
    check (btrim(title) <> ''),
  constraint retell_lecture_items_lecture_text_nonempty_check
    check (btrim(lecture_text) <> ''),
  constraint retell_lecture_items_difficulty_nonempty_check
    check (btrim(difficulty) <> ''),
  constraint retell_lecture_items_source_type_nonempty_check
    check (btrim(source_type) <> ''),
  constraint retell_lecture_items_created_by_nonempty_check
    check (btrim(created_by) <> ''),
  constraint retell_lecture_items_updated_by_nonempty_check
    check (btrim(updated_by) <> ''),
  constraint retell_lecture_items_difficulty_format_check
    check (difficulty ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint retell_lecture_items_source_type_format_check
    check (source_type ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint retell_lecture_items_lecture_word_count_check
    check (cardinality(regexp_split_to_array(btrim(lecture_text), E'\\s+')) between 110 and 145),
  constraint retell_lecture_items_review_points_count_check
    check (cardinality(review_points) = 4)
);

alter table public.retell_lecture_items enable row level security;

revoke all privileges on table public.retell_lecture_items from anon, authenticated;
grant select on table public.retell_lecture_items to anon, authenticated;

create policy "retell_lecture_items_public_read_active"
  on public.retell_lecture_items
  for select
  to anon, authenticated
  using (active = true);
