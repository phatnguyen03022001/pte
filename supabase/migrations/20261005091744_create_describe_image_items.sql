create table public.describe_image_items (
  id bigint generated always as identity primary key,
  slug text unique not null,
  title text not null,
  chart_type text not null,
  labels text[] not null,
  values numeric[] not null,
  unit text not null,
  review_points text[] not null,
  difficulty text not null,
  source_type text not null,
  source_ref text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active boolean not null default true,
  constraint describe_image_items_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint describe_image_items_title_nonempty_check
    check (btrim(title) <> ''),
  constraint describe_image_items_chart_type_check
    check (chart_type in ('bar', 'line')),
  constraint describe_image_items_unit_nonempty_check
    check (btrim(unit) <> ''),
  constraint describe_image_items_difficulty_nonempty_check
    check (btrim(difficulty) <> ''),
  constraint describe_image_items_source_type_nonempty_check
    check (btrim(source_type) <> ''),
  constraint describe_image_items_created_by_nonempty_check
    check (btrim(created_by) <> ''),
  constraint describe_image_items_updated_by_nonempty_check
    check (btrim(updated_by) <> ''),
  constraint describe_image_items_difficulty_format_check
    check (difficulty ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint describe_image_items_source_type_format_check
    check (source_type ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint describe_image_items_point_count_check
    check (cardinality(labels) between 4 and 8),
  constraint describe_image_items_values_match_labels_check
    check (cardinality(labels) = cardinality(values)),
  constraint describe_image_items_review_points_count_check
    check (cardinality(review_points) = 3)
);

alter table public.describe_image_items enable row level security;

revoke all privileges on table public.describe_image_items from anon, authenticated;
grant select on table public.describe_image_items to anon, authenticated;

create policy "describe_image_items_public_read_active"
  on public.describe_image_items
  for select
  to anon, authenticated
  using (active = true);
