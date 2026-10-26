import { describe, it, expect } from "vitest";
import { parseCsvContent } from "../lib/csv-parser";

describe("parseCsvContent", () => {
  it("should successfully parse valid English CSV content", () => {
    const csv = `question,choice_a,choice_b,choice_c,choice_d,answer
What is 2+2?,2,3,4,5,C
Capital of Thailand?,Chiang Mai,Bangkok,Phuket,Pattaya,B`;

    const result = parseCsvContent(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].question_text).toBe("What is 2+2?");
    expect(result.questions[0].correct_answer).toBe("C");
    expect(result.questions[1].correct_answer).toBe("B");
  });

  it("should handle Thai column names", () => {
    const csv = `คำถาม,ตัวเลือก_ก,ตัวเลือก_ข,ตัวเลือก_ค,ตัวเลือก_ง,เฉลย
เครือข่ายคอมพิวเตอร์คืออะไร,ระบบคอมพิวเตอร์,การเชื่อมต่อ,โปรแกรม,ฮาร์ดแวร์,B`;

    const result = parseCsvContent(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].correct_answer).toBe("B");
  });

  it("should handle UTF-8 with BOM correctly", () => {
    const csv = `\uFEFFquestion,choice_a,choice_b,choice_c,choice_d,answer
TCP/IP มีกี่เลเยอร์,4,5,6,7,B`;

    const result = parseCsvContent(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].correct_answer).toBe("B");
  });

  it("should reject CSV missing required headers", () => {
    const csv = `question,choice_a,choice_b,answer
Incomplete header?,1,2,A`;

    const result = parseCsvContent(csv);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("choice_c");
  });

  it("should reject invalid answer values", () => {
    const csv = `question,choice_a,choice_b,choice_c,choice_d,answer
Invalid answer letter?,A,B,C,D,E`;

    const result = parseCsvContent(csv);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("A, B, C หรือ D");
  });
});
