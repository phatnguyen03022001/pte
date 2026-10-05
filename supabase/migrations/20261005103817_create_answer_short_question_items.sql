create table public.answer_short_question_items (
  id bigint generated always as identity primary key,
  slug text unique not null,
  title text not null,
  question_text text not null,
  accepted_answers text[] not null,
  difficulty text not null,
  source_type text not null,
  source_ref text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active boolean not null default true,
  constraint answer_short_question_items_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint answer_short_question_items_title_nonempty_check
    check (btrim(title) <> ''),
  constraint answer_short_question_items_question_text_nonempty_check
    check (btrim(question_text) <> ''),
  constraint answer_short_question_items_difficulty_nonempty_check
    check (btrim(difficulty) <> ''),
  constraint answer_short_question_items_source_type_nonempty_check
    check (btrim(source_type) <> ''),
  constraint answer_short_question_items_created_by_nonempty_check
    check (btrim(created_by) <> ''),
  constraint answer_short_question_items_updated_by_nonempty_check
    check (btrim(updated_by) <> ''),
  constraint answer_short_question_items_difficulty_format_check
    check (difficulty ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint answer_short_question_items_source_type_format_check
    check (source_type ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint answer_short_question_items_question_word_count_check
    check (cardinality(regexp_split_to_array(btrim(question_text), E'\\s+')) between 6 and 18),
  constraint answer_short_question_items_accepted_answers_check
    check (
      cardinality(accepted_answers) between 1 and 4
      and coalesce(btrim(accepted_answers[1]), '') <> ''
      and (cardinality(accepted_answers) < 2 or coalesce(btrim(accepted_answers[2]), '') <> '')
      and (cardinality(accepted_answers) < 3 or coalesce(btrim(accepted_answers[3]), '') <> '')
      and (cardinality(accepted_answers) < 4 or coalesce(btrim(accepted_answers[4]), '') <> '')
    )
);

alter table public.answer_short_question_items enable row level security;

revoke all privileges on table public.answer_short_question_items from anon, authenticated;
grant select on table public.answer_short_question_items to anon, authenticated;

create policy "answer_short_question_items_public_read_active"
  on public.answer_short_question_items
  for select
  to anon, authenticated
  using (active = true);
