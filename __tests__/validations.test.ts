import { describe, it, expect } from "vitest";
import { StudentInfoSchema, SubmitExamSchema, ImportCsvSchema } from "../lib/validations";

describe("Validations Schema", () => {
  it("should validate correct student info", () => {
    const valid = {
      firstName: "สมชาย",
      lastName: "ใจดี",
      studentId: "65012345",
    };
    const result = StudentInfoSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("should reject student info with empty fields", () => {
    const invalid = {
      firstName: "",
      lastName: "ใจดี",
      studentId: "65012345",
    };
    const result = StudentInfoSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should validate CSV import schema", () => {
    const result = ImportCsvSchema.safeParse({
      title: "แบบทดสอบคอมพิวเตอร์",
      description: "คำอธิบายชุดข้อสอบ",
    });
    expect(result.success).toBe(true);
  });

  it("should reject overly long quiz titles", () => {
    const result = ImportCsvSchema.safeParse({
      title: "A".repeat(125),
    });
    expect(result.success).toBe(false);
  });
});
