import { z } from "zod/v4";

export const StudentInfoSchema = z.object({
  firstName: z.string().min(1, "กรุณากรอกชื่อ").max(100).trim(),
  lastName: z.string().min(1, "กรุณากรอกนามสกุล").max(100).trim(),
  studentId: z
    .string()
    .min(1, "กรุณากรอกรหัสนักศึกษา")
    .max(40)
    .trim()
    .regex(/^[\p{L}\p{N}._/-]+$/u, "รูปแบบรหัสนักศึกษาไม่ถูกต้อง"),
});

export const AnswerValueSchema = z.enum(["A", "B", "C", "D"]);

export const SubmitExamSchema = z.object({
  quizId: z.string().uuid("รหัสชุดข้อสอบไม่ถูกต้อง"),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  studentId: z
    .string()
    .min(1)
    .max(40)
    .trim()
    .regex(/^[\p{L}\p{N}._/-]+$/u),
  answers: z.record(z.string().uuid(), AnswerValueSchema),
  idempotencyKey: z.string().uuid().optional(),
});

export const ImportCsvSchema = z.object({
  title: z
    .string()
    .min(1, "กรุณาระบุชื่อชุดข้อสอบ")
    .max(120, "ชื่อชุดข้อสอบต้องไม่เกิน 120 ตัวอักษร")
    .trim(),
  description: z.string().max(500).trim().optional(),
});

export type StudentInfo = z.infer<typeof StudentInfoSchema>;
export type SubmitExam = z.infer<typeof SubmitExamSchema>;
