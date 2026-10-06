create table public.respond_to_a_situation_items (
  id bigint generated always as identity primary key,
  slug text unique not null,
  title text not null,
  situation_text text not null,
  review_points text[] not null,
  difficulty text not null,
  source_type text not null,
  source_ref text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active boolean not null default true,
  constraint respond_to_a_situation_items_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint respond_to_a_situation_items_title_nonempty_check
    check (btrim(title) <> ''),
  constraint respond_to_a_situation_items_situation_text_nonempty_check
    check (btrim(situation_text) <> ''),
  constraint respond_to_a_situation_items_difficulty_nonempty_check
    check (btrim(difficulty) <> ''),
  constraint respond_to_a_situation_items_source_type_nonempty_check
    check (btrim(source_type) <> ''),
  constraint respond_to_a_situation_items_created_by_nonempty_check
    check (btrim(created_by) <> ''),
  constraint respond_to_a_situation_items_updated_by_nonempty_check
    check (btrim(updated_by) <> ''),
  constraint respond_to_a_situation_items_difficulty_format_check
    check (difficulty ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint respond_to_a_situation_items_source_type_format_check
    check (source_type ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint respond_to_a_situation_items_situation_word_count_check
    check (
      cardinality(regexp_split_to_array(btrim(situation_text), E'\\s+'))
      between 35 and 60
    ),
  constraint respond_to_a_situation_items_review_points_check
    check (
      cardinality(review_points) = 5
      and coalesce(btrim(review_points[1]), '') <> ''
      and coalesce(btrim(review_points[2]), '') <> ''
      and coalesce(btrim(review_points[3]), '') <> ''
      and coalesce(btrim(review_points[4]), '') <> ''
      and coalesce(btrim(review_points[5]), '') <> ''
    )
);

alter table public.respond_to_a_situation_items enable row level security;

revoke all privileges on table public.respond_to_a_situation_items from anon, authenticated;
grant select on table public.respond_to_a_situation_items to anon, authenticated;

create policy "respond_to_a_situation_items_public_read_active"
  on public.respond_to_a_situation_items
  for select
  to anon, authenticated
  using (active = true);
