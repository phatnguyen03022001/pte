create table public.study_content (
  id bigint generated always as identity primary key,
  slug text unique not null,
  type text not null,
  skill_code text,
  task_type text,
  title text not null,
  body_markdown text not null,
  difficulty text,
  target_score smallint,
  source_type text not null,
  source_ref text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active boolean not null default true,
  constraint study_content_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint study_content_type_check
    check (type in ('strategy', 'template', 'skill_guide', 'common_mistake', 'playbook', 'plan')),
  constraint study_content_task_type_format_check
    check (task_type is null or task_type ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint study_content_difficulty_format_check
    check (difficulty is null or difficulty ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint study_content_source_type_format_check
    check (source_type ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'),
  constraint study_content_title_nonempty_check
    check (btrim(title) <> ''),
  constraint study_content_body_markdown_nonempty_check
    check (btrim(body_markdown) <> ''),
  constraint study_content_created_by_nonempty_check
    check (btrim(created_by) <> ''),
  constraint study_content_updated_by_nonempty_check
    check (btrim(updated_by) <> ''),
  constraint study_content_source_type_nonempty_check
    check (btrim(source_type) <> ''),
  constraint study_content_target_score_check
    check (target_score is null or target_score between 10 and 90),
  constraint study_content_skill_code_fkey
    foreign key (skill_code) references public.skills(code)
    on update restrict on delete restrict
);

create table public.study_content_subskills (
  study_content_id bigint not null,
  subskill_code text not null,
  constraint study_content_subskills_pkey
    primary key (study_content_id, subskill_code),
  constraint study_content_subskills_study_content_id_fkey
    foreign key (study_content_id) references public.study_content(id)
    on update restrict on delete restrict,
  constraint study_content_subskills_subskill_code_fkey
    foreign key (subskill_code) references public.subskills(code)
    on update restrict on delete restrict
);

create index study_content_subskills_subskill_code_idx
  on public.study_content_subskills (subskill_code);

alter table public.study_content enable row level security;
alter table public.study_content_subskills enable row level security;

revoke all privileges on table public.study_content from anon, authenticated;
revoke all privileges on table public.study_content_subskills from anon, authenticated;

grant select on table public.study_content to anon, authenticated;
grant select on table public.study_content_subskills to anon, authenticated;

create policy "study_content_public_read_active"
  on public.study_content
  for select
  to anon, authenticated
  using (active = true);

create policy "study_content_subskills_public_read_active"
  on public.study_content_subskills
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.study_content
      where study_content.id = study_content_subskills.study_content_id
        and study_content.active = true
    )
  );
