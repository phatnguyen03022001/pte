create table public.reading_multiple_choice_multiple_answers_items (
  id bigint generated always as identity primary key,
  slug text unique not null,
  title text not null,
  passage_text text not null,
  question_text text not null,
  options text[] not null,
  correct_indexes integer[] not null,
  explanation_text text not null,
  difficulty text not null,
  source_type text not null,
  source_ref text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active boolean not null default true,
  constraint reading_mcma_items_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint reading_mcma_items_title_nonempty_check
    check (btrim(title) <> ''),
  constraint reading_mcma_items_passage_text_nonempty_check
    check (btrim(passage_text) <> ''),
  constraint reading_mcma_items_question_text_nonempty_check
    check (btrim(question_text) <> ''),
  constraint reading_mcma_items_explanation_text_nonempty_check
    check (btrim(explanation_text) <> ''),
  constraint reading_mcma_items_difficulty_nonempty_check
    check (btrim(difficulty) <> ''),
  constraint reading_mcma_items_source_type_nonempty_check
    check (btrim(source_type) <> ''),
  constraint reading_mcma_items_created_by_nonempty_check
    check (btrim(created_by) <> ''),
  constraint reading_mcma_items_updated_by_nonempty_check
    check (btrim(updated_by) <> ''),
  constraint reading_mcma_items_difficulty_format_check
    check (difficulty ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint reading_mcma_items_source_type_format_check
    check (source_type ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint reading_mcma_items_passage_word_count_check
    check (
      cardinality(regexp_split_to_array(btrim(passage_text), E'\\s+'))
      between 120 and 220
    ),
  constraint reading_mcma_items_options_check
    check (
      cardinality(options) = 5
      and array_lower(options, 1) = 1
      and array_upper(options, 1) = 5
      and coalesce(btrim(options[1]), '') <> ''
      and coalesce(btrim(options[2]), '') <> ''
      and coalesce(btrim(options[3]), '') <> ''
      and coalesce(btrim(options[4]), '') <> ''
      and coalesce(btrim(options[5]), '') <> ''
    ),
  constraint reading_mcma_items_correct_indexes_check
    check (
      cardinality(correct_indexes) = 2
      and array_lower(correct_indexes, 1) = 1
      and array_upper(correct_indexes, 1) = 2
      and correct_indexes[1] between 0 and 4
      and correct_indexes[2] between 0 and 4
      and correct_indexes[1] <> correct_indexes[2]
    )
);

alter table public.reading_multiple_choice_multiple_answers_items
  enable row level security;

revoke all privileges
  on table public.reading_multiple_choice_multiple_answers_items
  from anon, authenticated;

grant select
  on table public.reading_multiple_choice_multiple_answers_items
  to anon, authenticated;

create policy "reading_mcma_items_public_read_active"
  on public.reading_multiple_choice_multiple_answers_items
  for select
  to anon, authenticated
  using (active = true);
