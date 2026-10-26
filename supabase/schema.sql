-- Run in Supabase SQL Editor on a fresh project.
create type public.user_role as enum ('student', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, role) values (new.id, 'student');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text,
  created_by uuid not null references public.profiles(id),
  question_count integer not null default 0 check (question_count >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_text text not null,
  choice_a text not null, choice_b text not null, choice_c text not null, choice_d text not null,
  created_at timestamptz not null default now()
);

-- Answer keys are stored separately and students have no SELECT policy on this table.
create table public.answer_keys (
  question_id uuid primary key references public.questions(id) on delete cascade,
  correct_answer char(1) not null check (correct_answer in ('A','B','C','D'))
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  student_first_name text,
  student_last_name text,
  student_id text,
  quiz_id uuid not null references public.quizzes(id),
  score integer not null check (score >= 0),
  total_questions integer not null check (total_questions > 0),
  submitted_at timestamptz not null default now()
);

create table public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  selected_answer char(1) check (selected_answer in ('A','B','C','D')),
  is_correct boolean not null,
  unique (attempt_id, question_id)
);

create index questions_quiz_id_idx on public.questions(quiz_id);
create index attempts_user_id_submitted_idx on public.attempts(user_id, submitted_at desc);
create index quizzes_published_created_idx on public.quizzes(is_published, created_at desc);

alter table public.profiles enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.answer_keys enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;

create function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "profiles_read_self_or_admin" on public.profiles
for select to authenticated using (id = (select auth.uid()) or public.is_admin());
-- Intentionally no policy for users to update roles.

create policy "published_quizzes_read" on public.quizzes
for select to authenticated using (is_published or public.is_admin());
create policy "admins_insert_quizzes" on public.quizzes
for insert to authenticated with check (public.is_admin() and created_by = (select auth.uid()));
create policy "admins_update_quizzes" on public.quizzes
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins_delete_quizzes" on public.quizzes
for delete to authenticated using (public.is_admin());

create policy "questions_read_published_quiz" on public.questions
for select to authenticated using (
  public.is_admin() or exists (select 1 from public.quizzes q where q.id = quiz_id and q.is_published = true)
);
create policy "admins_insert_questions" on public.questions
for insert to authenticated with check (public.is_admin());
create policy "admins_update_questions" on public.questions
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins_delete_questions" on public.questions
for delete to authenticated using (public.is_admin());

-- Only trusted server code using the service-role key can access answer_keys.
-- Do not create a student SELECT policy on answer_keys.
create policy "attempts_read_own_or_admin" on public.attempts
for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "attempt_answers_read_own_or_admin" on public.attempt_answers
for select to authenticated using (
  public.is_admin() or exists (select 1 from public.attempts a
    where a.id = attempt_id and a.user_id = (select auth.uid()))
);
