-- ====================================================================
-- QuizHub: Complete Database Setup (Unified Schema + Migration V2)
-- Copy and run this ENTIRE script in Supabase SQL Editor.
-- Safe to run on fresh or existing database.
-- ====================================================================

-- 1. Create Enum for User Roles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('student', 'admin');
  END IF;
END $$;

-- 2. Profiles Table (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'student',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger to auto-create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, 'student')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Quizzes Table
CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description text,
  created_by uuid REFERENCES public.profiles(id),
  question_count integer NOT NULL DEFAULT 0 CHECK (question_count >= 0),
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Questions Table
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  choice_a text NOT NULL,
  choice_b text NOT NULL,
  choice_c text NOT NULL,
  choice_d text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure position column exists if upgraded
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'position'
  ) THEN
    ALTER TABLE public.questions ADD COLUMN position integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 5. Answer Keys Table (Stored separately for strict anti-cheat)
CREATE TABLE IF NOT EXISTS public.answer_keys (
  question_id uuid PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
  correct_answer char(1) NOT NULL CHECK (correct_answer IN ('A','B','C','D'))
);

-- 6. Attempts Table
CREATE TABLE IF NOT EXISTS public.attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  student_first_name text,
  student_last_name text,
  student_id text,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0),
  total_questions integer NOT NULL CHECK (total_questions > 0),
  correct_count integer NOT NULL DEFAULT 0,
  percentage numeric(6,2) NOT NULL DEFAULT 0,
  google_sheets_status text NOT NULL DEFAULT 'pending',
  google_sheets_error text,
  idempotency_key text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure all upgraded columns exist on attempts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'student_first_name') THEN
    ALTER TABLE public.attempts ADD COLUMN student_first_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'student_last_name') THEN
    ALTER TABLE public.attempts ADD COLUMN student_last_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'student_id') THEN
    ALTER TABLE public.attempts ADD COLUMN student_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'correct_count') THEN
    ALTER TABLE public.attempts ADD COLUMN correct_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'percentage') THEN
    ALTER TABLE public.attempts ADD COLUMN percentage numeric(6,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'google_sheets_status') THEN
    ALTER TABLE public.attempts ADD COLUMN google_sheets_status text NOT NULL DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'google_sheets_error') THEN
    ALTER TABLE public.attempts ADD COLUMN google_sheets_error text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'idempotency_key') THEN
    ALTER TABLE public.attempts ADD COLUMN idempotency_key text;
  END IF;
  -- Allow user_id to be nullable for direct public examinees
  ALTER TABLE public.attempts ALTER COLUMN user_id DROP NOT NULL;
END $$;

-- 7. Attempt Answers Details Table
CREATE TABLE IF NOT EXISTS public.attempt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id),
  selected_answer char(1) CHECK (selected_answer IN ('A','B','C','D')),
  is_correct boolean NOT NULL,
  UNIQUE (attempt_id, question_id)
);

-- 8. Indexes for performance and search
CREATE INDEX IF NOT EXISTS questions_quiz_id_idx ON public.questions(quiz_id);
CREATE INDEX IF NOT EXISTS questions_position_idx ON public.questions(quiz_id, position);
CREATE INDEX IF NOT EXISTS attempts_user_id_submitted_idx ON public.attempts(user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS attempts_student_id_idx ON public.attempts(student_id);
CREATE INDEX IF NOT EXISTS attempts_quiz_id_idx ON public.attempts(quiz_id);
CREATE INDEX IF NOT EXISTS attempts_submitted_at_idx ON public.attempts(submitted_at DESC);
CREATE INDEX IF NOT EXISTS quizzes_published_created_idx ON public.quizzes(is_published, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS attempts_idempotency_key_idx ON public.attempts(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 9. Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;

-- Admin check helper function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Policies for Profiles
DO $$ BEGIN
  DROP POLICY IF EXISTS "profiles_read_self_or_admin" ON public.profiles;
  CREATE POLICY "profiles_read_self_or_admin" ON public.profiles
    FOR SELECT TO authenticated USING (id = (SELECT auth.uid()) OR public.is_admin());
END $$;

-- Policies for Quizzes
DO $$ BEGIN
  DROP POLICY IF EXISTS "published_quizzes_read" ON public.quizzes;
  CREATE POLICY "published_quizzes_read" ON public.quizzes
    FOR SELECT TO authenticated USING (is_published OR public.is_admin());

  DROP POLICY IF EXISTS "anon_read_published_quizzes" ON public.quizzes;
  CREATE POLICY "anon_read_published_quizzes" ON public.quizzes
    FOR SELECT TO anon USING (is_published = true);

  DROP POLICY IF EXISTS "admins_insert_quizzes" ON public.quizzes;
  CREATE POLICY "admins_insert_quizzes" ON public.quizzes
    FOR INSERT TO authenticated WITH CHECK (public.is_admin() AND created_by = (SELECT auth.uid()));

  DROP POLICY IF EXISTS "admins_update_quizzes" ON public.quizzes;
  CREATE POLICY "admins_update_quizzes" ON public.quizzes
    FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

  DROP POLICY IF EXISTS "admins_delete_quizzes" ON public.quizzes;
  CREATE POLICY "admins_delete_quizzes" ON public.quizzes
    FOR DELETE TO authenticated USING (public.is_admin());
END $$;

-- Policies for Questions
DO $$ BEGIN
  DROP POLICY IF EXISTS "questions_read_published_quiz" ON public.questions;
  CREATE POLICY "questions_read_published_quiz" ON public.questions
    FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND (q.is_published OR public.is_admin()))
    );

  DROP POLICY IF EXISTS "anon_read_published_questions" ON public.questions;
  CREATE POLICY "anon_read_published_questions" ON public.questions
    FOR SELECT TO anon USING (
      EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.is_published = true)
    );
END $$;

-- Policies for Attempts
DO $$ BEGIN
  DROP POLICY IF EXISTS "attempts_read_own_or_admin" ON public.attempts;
  CREATE POLICY "attempts_read_own_or_admin" ON public.attempts
    FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR public.is_admin());

  DROP POLICY IF EXISTS "attempts_read_admin" ON public.attempts;
  CREATE POLICY "attempts_read_admin" ON public.attempts
    FOR SELECT TO authenticated USING (public.is_admin());
END $$;

-- Policies for Attempt Answers
DO $$ BEGIN
  DROP POLICY IF EXISTS "attempt_answers_read_own_or_admin" ON public.attempt_answers;
  CREATE POLICY "attempt_answers_read_own_or_admin" ON public.attempt_answers
    FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM public.attempts a WHERE a.id = attempt_id AND (a.user_id = (SELECT auth.uid()) OR public.is_admin()))
    );
END $$;
