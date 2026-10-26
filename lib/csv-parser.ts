import "server-only";
import { parse } from "csv-parse/sync";

/** Standard English column names */
const REQUIRED_COLUMNS = [
  "question",
  "choice_a",
  "choice_b",
  "choice_c",
  "choice_d",
  "answer",
] as const;

/** Mapping from common Thai column names to English */
const THAI_COLUMN_MAP: Record<string, string> = {
  คำถาม: "question",
  ตัวเลือก_ก: "choice_a",
  ตัวเลือก_ข: "choice_b",
  ตัวเลือก_ค: "choice_c",
  ตัวเลือก_ง: "choice_d",
  ตัวเลือกก: "choice_a",
  ตัวเลือกข: "choice_b",
  ตัวเลือกค: "choice_c",
  ตัวเลือกง: "choice_d",
  เฉลย: "answer",
  คำตอบ: "answer",
};

const VALID_ANSWERS = new Set(["A", "B", "C", "D"]);

export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
export const MAX_QUESTIONS = 500;

export interface ParsedQuestion {
  question_text: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct_answer: string;
  position: number;
}

export interface CsvParseResult {
  questions: ParsedQuestion[];
  errors: string[];
}

function normalizeColumnName(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  // Try Thai mapping first
  for (const [thai, eng] of Object.entries(THAI_COLUMN_MAP)) {
    if (trimmed === thai.toLowerCase()) return eng;
  }
  // Remove spaces/underscores for flexible matching
  const normalized = trimmed.replace(/[\s_-]+/g, "_");
  if (REQUIRED_COLUMNS.includes(normalized as (typeof REQUIRED_COLUMNS)[number])) {
    return normalized;
  }
  return trimmed;
}

export function parseCsvContent(content: string): CsvParseResult {
  const errors: string[] = [];

  // Strip UTF-8 BOM
  const cleanContent = content.replace(/^\uFEFF/, "");

  let rows: Record<string, string>[];
  try {
    rows = parse(cleanContent, {
      bom: true,
      columns: (headers: string[]) => headers.map(normalizeColumnName),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "ไม่สามารถอ่านไฟล์ CSV ได้";
    errors.push(`อ่าน CSV ไม่สำเร็จ: ${msg}`);
    return { questions: [], errors };
  }

  if (rows.length === 0) {
    errors.push("ไฟล์ไม่มีข้อสอบ");
    return { questions: [], errors };
  }

  if (rows.length > MAX_QUESTIONS) {
    errors.push(`นำเข้าได้ไม่เกิน ${MAX_QUESTIONS} ข้อต่อครั้ง (พบ ${rows.length} ข้อ)`);
    return { questions: [], errors };
  }

  // Check required columns
  const headers = Object.keys(rows[0]);
  const missingCols = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missingCols.length > 0) {
    errors.push(
      `ขาดหัวคอลัมน์: ${missingCols.join(", ")} (พบเฉพาะ: ${headers.join(", ")})`
    );
    return { questions: [], errors };
  }

  const questions: ParsedQuestion[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +1 for header, +1 for 1-indexed
    const rowErrors: string[] = [];

    const questionText = (row.question ?? "").trim();
    const choiceA = (row.choice_a ?? "").trim();
    const choiceB = (row.choice_b ?? "").trim();
    const choiceC = (row.choice_c ?? "").trim();
    const choiceD = (row.choice_d ?? "").trim();
    const answer = (row.answer ?? "").trim().toUpperCase();

    if (!questionText) rowErrors.push("ไม่มีคำถาม");
    if (!choiceA) rowErrors.push("ไม่มีตัวเลือก A");
    if (!choiceB) rowErrors.push("ไม่มีตัวเลือก B");
    if (!choiceC) rowErrors.push("ไม่มีตัวเลือก C");
    if (!choiceD) rowErrors.push("ไม่มีตัวเลือก D");
    if (!VALID_ANSWERS.has(answer))
      rowErrors.push(`เฉลย "${row.answer}" ไม่ถูกต้อง (ต้องเป็น A, B, C หรือ D)`);

    if (rowErrors.length > 0) {
      errors.push(`แถวที่ ${rowNum}: ${rowErrors.join(", ")}`);
      continue;
    }

    questions.push({
      question_text: questionText,
      choice_a: choiceA,
      choice_b: choiceB,
      choice_c: choiceC,
      choice_d: choiceD,
      correct_answer: answer,
      position: i + 1,
    });
  }

  return { questions, errors };
}
