create table public.summarize_group_discussion_items (
  id bigint generated always as identity primary key,
  slug text unique not null,
  title text not null,
  speaker_a_1 text not null,
  speaker_b_1 text not null,
  speaker_c_1 text not null,
  speaker_a_2 text not null,
  speaker_b_2 text not null,
  speaker_c_2 text not null,
  review_points text[] not null,
  difficulty text not null,
  source_type text not null,
  source_ref text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active boolean not null default true,
  constraint summarize_group_discussion_items_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint summarize_group_discussion_items_title_nonempty_check
    check (btrim(title) <> ''),
  constraint summarize_group_discussion_items_speaker_a_1_nonempty_check
    check (btrim(speaker_a_1) <> ''),
  constraint summarize_group_discussion_items_speaker_b_1_nonempty_check
    check (btrim(speaker_b_1) <> ''),
  constraint summarize_group_discussion_items_speaker_c_1_nonempty_check
    check (btrim(speaker_c_1) <> ''),
  constraint summarize_group_discussion_items_speaker_a_2_nonempty_check
    check (btrim(speaker_a_2) <> ''),
  constraint summarize_group_discussion_items_speaker_b_2_nonempty_check
    check (btrim(speaker_b_2) <> ''),
  constraint summarize_group_discussion_items_speaker_c_2_nonempty_check
    check (btrim(speaker_c_2) <> ''),
  constraint summarize_group_discussion_items_difficulty_nonempty_check
    check (btrim(difficulty) <> ''),
  constraint summarize_group_discussion_items_source_type_nonempty_check
    check (btrim(source_type) <> ''),
  constraint summarize_group_discussion_items_created_by_nonempty_check
    check (btrim(created_by) <> ''),
  constraint summarize_group_discussion_items_updated_by_nonempty_check
    check (btrim(updated_by) <> ''),
  constraint summarize_group_discussion_items_difficulty_format_check
    check (difficulty ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint summarize_group_discussion_items_source_type_format_check
    check (source_type ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint summarize_group_discussion_items_script_word_count_check
    check (
      cardinality(
        regexp_split_to_array(
          btrim(
            concat_ws(
              ' ',
              speaker_a_1,
              speaker_b_1,
              speaker_c_1,
              speaker_a_2,
              speaker_b_2,
              speaker_c_2
            )
          ),
          E'\\s+'
        )
      ) between 120 and 180
    ),
  constraint summarize_group_discussion_items_review_points_check
    check (
      cardinality(review_points) = 5
      and coalesce(btrim(review_points[1]), '') <> ''
      and coalesce(btrim(review_points[2]), '') <> ''
      and coalesce(btrim(review_points[3]), '') <> ''
      and coalesce(btrim(review_points[4]), '') <> ''
      and coalesce(btrim(review_points[5]), '') <> ''
    )
);

alter table public.summarize_group_discussion_items enable row level security;

revoke all privileges on table public.summarize_group_discussion_items from anon, authenticated;
grant select on table public.summarize_group_discussion_items to anon, authenticated;

create policy "summarize_group_discussion_items_public_read_active"
  on public.summarize_group_discussion_items
  for select
  to anon, authenticated
  using (active = true);
