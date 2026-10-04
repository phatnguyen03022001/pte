create table public.skills (
  code text primary key,
  label text not null,
  sort_order smallint not null,
  constraint skills_sort_order_nonnegative check (sort_order >= 0),
  constraint skills_code_format_check check (code ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$')
);

create table public.subskills (
  code text primary key,
  label text not null,
  description text,
  constraint subskills_code_format_check check (code ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$')
);

create table public.skill_subskills (
  skill_code text not null,
  subskill_code text not null,
  constraint skill_subskills_pkey primary key (skill_code, subskill_code),
  constraint skill_subskills_skill_code_fkey
    foreign key (skill_code) references public.skills(code)
    on update restrict on delete restrict,
  constraint skill_subskills_subskill_code_fkey
    foreign key (subskill_code) references public.subskills(code)
    on update restrict on delete restrict
);

create index skill_subskills_subskill_code_idx
  on public.skill_subskills (subskill_code);

insert into public.skills (code, label, sort_order) values
  ('listening', 'Listening', 1),
  ('speaking', 'Speaking', 2),
  ('reading', 'Reading', 3),
  ('writing', 'Writing', 4);

alter table public.skills enable row level security;
alter table public.subskills enable row level security;
alter table public.skill_subskills enable row level security;

revoke all privileges on table public.skills from anon, authenticated;
revoke all privileges on table public.subskills from anon, authenticated;
revoke all privileges on table public.skill_subskills from anon, authenticated;

grant select on table public.skills to anon, authenticated;
grant select on table public.subskills to anon, authenticated;
grant select on table public.skill_subskills to anon, authenticated;

create policy "skills_public_read"
  on public.skills for select to anon, authenticated using (true);

create policy "subskills_public_read"
  on public.subskills for select to anon, authenticated using (true);

create policy "skill_subskills_public_read"
  on public.skill_subskills for select to anon, authenticated using (true);
