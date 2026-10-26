-- Migration V2: Add missing fields required by spec
-- Safe to re-run (uses IF NOT EXISTS / DO blocks)

-- 1. Add position column to questions for ordering
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'position'
  ) THEN
    ALTER TABLE public.questions ADD COLUMN position integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2. Add missing columns to attempts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'correct_count'
  ) THEN
    ALTER TABLE public.attempts ADD COLUMN correct_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'percentage'
  ) THEN
    ALTER TABLE public.attempts ADD COLUMN percentage numeric(6,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'google_sheets_status'
  ) THEN
    ALTER TABLE public.attempts ADD COLUMN google_sheets_status text NOT NULL DEFAULT 'pending';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'google_sheets_error'
  ) THEN
    ALTER TABLE public.attempts ADD COLUMN google_sheets_error text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.attempts ADD COLUMN idempotency_key text;
  END IF;
END $$;

-- 3. Add indexes for search
CREATE INDEX IF NOT EXISTS attempts_student_id_idx ON public.attempts(student_id);
CREATE INDEX IF NOT EXISTS attempts_quiz_id_idx ON public.attempts(quiz_id);
CREATE INDEX IF NOT EXISTS attempts_submitted_at_idx ON public.attempts(submitted_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS attempts_idempotency_key_idx ON public.attempts(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 4. Add question position index
CREATE INDEX IF NOT EXISTS questions_position_idx ON public.questions(quiz_id, position);

-- 5. RLS policies for anonymous access (public exam)
-- Allow anon to read published quizzes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_published_quizzes' AND tablename = 'quizzes'
  ) THEN
    CREATE POLICY anon_read_published_quizzes ON public.quizzes
      FOR SELECT TO anon USING (is_published = true);
  END IF;
END $$;

-- Allow anon to read questions of published quizzes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_published_questions' AND tablename = 'questions'
  ) THEN
    CREATE POLICY anon_read_published_questions ON public.questions
      FOR SELECT TO anon USING (
        EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.is_published = true)
      );
  END IF;
END $$;

-- 6. RPC for grading and saving attempt atomically
CREATE OR REPLACE FUNCTION public.grade_and_save_attempt(
  p_quiz_id uuid,
  p_student_id text,
  p_first_name text,
  p_last_name text,
  p_answers jsonb,  -- { "question_id": "selected_answer", ... }
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_quiz record;
  v_total integer;
  v_score integer := 0;
  v_percentage numeric(6,2);
  v_attempt_id uuid;
  v_key text;
  v_value text;
  v_correct text;
  v_question_ids uuid[];
  v_submitted_ids uuid[];
  v_existing_attempt_id uuid;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_attempt_id
    FROM public.attempts
    WHERE idempotency_key = p_idempotency_key;
    
    IF v_existing_attempt_id IS NOT NULL THEN
      -- Return existing result
      RETURN (
        SELECT jsonb_build_object(
          'ok', true,
          'duplicate', true,
          'attemptId', a.id,
          'score', a.score,
          'totalQuestions', a.total_questions,
          'correctCount', a.correct_count,
          'percentage', a.percentage,
          'submittedAt', a.submitted_at
        )
        FROM public.attempts a WHERE a.id = v_existing_attempt_id
      );
    END IF;
  END IF;

  -- Validate quiz exists and is published
  SELECT id, title INTO v_quiz
  FROM public.quizzes
  WHERE id = p_quiz_id AND is_published = true;
  
  IF v_quiz IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ไม่พบชุดข้อสอบหรือยังไม่ได้เผยแพร่');
  END IF;

  -- Get all question IDs for this quiz
  SELECT array_agg(q.id ORDER BY q.position, q.created_at)
  INTO v_question_ids
  FROM public.questions q
  WHERE q.quiz_id = p_quiz_id;

  IF v_question_ids IS NULL OR array_length(v_question_ids, 1) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ชุดข้อสอบไม่มีคำถาม');
  END IF;

  v_total := array_length(v_question_ids, 1);

  -- Validate submitted answers match question IDs
  SELECT array_agg(key::uuid)
  INTO v_submitted_ids
  FROM jsonb_each_text(p_answers);

  IF v_submitted_ids IS NULL OR array_length(v_submitted_ids, 1) != v_total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'จำนวนคำตอบไม่ตรงกับจำนวนข้อสอบ');
  END IF;

  -- Check all submitted IDs are valid question IDs
  IF EXISTS (
    SELECT 1 FROM unnest(v_submitted_ids) AS sid
    WHERE sid != ALL(v_question_ids)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'พบรหัสคำถามที่ไม่ถูกต้อง');
  END IF;

  -- Calculate score
  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_answers) LOOP
    IF v_value NOT IN ('A', 'B', 'C', 'D') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'คำตอบต้องเป็น A, B, C หรือ D');
    END IF;
    
    SELECT ak.correct_answer INTO v_correct
    FROM public.answer_keys ak
    WHERE ak.question_id = v_key::uuid;
    
    IF v_correct IS NOT NULL AND v_value = v_correct THEN
      v_score := v_score + 1;
    END IF;
  END LOOP;

  v_percentage := ROUND((v_score::numeric / v_total) * 100, 2);

  -- Insert attempt
  INSERT INTO public.attempts (
    quiz_id, student_id, student_first_name, student_last_name,
    score, total_questions, correct_count, percentage,
    submitted_at, google_sheets_status, idempotency_key
  ) VALUES (
    p_quiz_id, p_student_id, p_first_name, p_last_name,
    v_score, v_total, v_score, v_percentage,
    now(), 'pending', p_idempotency_key
  )
  RETURNING id INTO v_attempt_id;

  -- Insert attempt answers
  INSERT INTO public.attempt_answers (attempt_id, question_id, selected_answer, is_correct)
  SELECT 
    v_attempt_id,
    (kv.key)::uuid,
    kv.value,
    kv.value = COALESCE(ak.correct_answer, '')
  FROM jsonb_each_text(p_answers) AS kv
  LEFT JOIN public.answer_keys ak ON ak.question_id = (kv.key)::uuid;

  RETURN jsonb_build_object(
    'ok', true,
    'attemptId', v_attempt_id,
    'score', v_score,
    'totalQuestions', v_total,
    'correctCount', v_score,
    'percentage', v_percentage,
    'submittedAt', now()
  );
END;
$$;

-- Grant execute to service role only (no direct client access)
REVOKE ALL ON FUNCTION public.grade_and_save_attempt FROM public;
REVOKE ALL ON FUNCTION public.grade_and_save_attempt FROM anon;
REVOKE ALL ON FUNCTION public.grade_and_save_attempt FROM authenticated;
