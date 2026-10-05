create table public.repeat_sentence_items (
  id bigint generated always as identity primary key,
  slug text unique not null,
  sentence text not null,
  difficulty text not null,
  source_type text not null,
  source_ref text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active boolean not null default true,
  constraint repeat_sentence_items_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint repeat_sentence_items_sentence_nonempty_check
    check (btrim(sentence) <> ''),
  constraint repeat_sentence_items_difficulty_nonempty_check
    check (btrim(difficulty) <> ''),
  constraint repeat_sentence_items_source_type_nonempty_check
    check (btrim(source_type) <> ''),
  constraint repeat_sentence_items_created_by_nonempty_check
    check (btrim(created_by) <> ''),
  constraint repeat_sentence_items_updated_by_nonempty_check
    check (btrim(updated_by) <> ''),
  constraint repeat_sentence_items_difficulty_format_check
    check (difficulty ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint repeat_sentence_items_source_type_format_check
    check (source_type ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$')
);

alter table public.repeat_sentence_items enable row level security;

revoke all privileges on table public.repeat_sentence_items from anon, authenticated;
grant select on table public.repeat_sentence_items to anon, authenticated;

create policy "repeat_sentence_items_public_read_active"
  on public.repeat_sentence_items
  for select
  to anon, authenticated
  using (active = true);
