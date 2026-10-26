"use client";

import { useState } from "react";
import Link from "next/link";

interface ImportSuccess {
  quizId: string;
  title: string;
  count: number;
}

export default function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [previewError, setPreviewError] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [successData, setSuccessData] = useState<ImportSuccess | null>(null);
  const [busy, setBusy] = useState(false);

  function handleFileChange(selectedFile: File | null) {
    setFile(selectedFile);
    setPreviewRows([]);
    setPreviewError("");
    setMessage(null);
    setSuccessData(null);

    if (!selectedFile) return;

    if (!title) {
      // Auto-suggest title from filename
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setTitle(baseName);
    }

    // Quick client-side preview
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length === 0) {
          setPreviewError("ไฟล์ว่างเปล่า");
          return;
        }

        // Preview up to 4 rows
        const sample = lines.slice(0, 4).map((line) => {
          // Simple split for preview only
          return line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
        });
        setPreviewRows(sample);
      } catch {
        setPreviewError("ไม่สามารถอ่านตัวอย่างไฟล์ได้");
      }
    };
    reader.readAsText(selectedFile.slice(0, 4096)); // read first 4KB
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setMessage({ type: "error", text: "กรุณาเลือกไฟล์ CSV" });
      return;
    }
    setBusy(true);
    setMessage(null);
    setSuccessData(null);

    const body = new FormData();
    body.set("file", file);
    body.set("title", title.trim());
    body.set("description", description.trim());

    try {
      const response = await fetch("/api/admin/import", { method: "POST", body });
      const result = await response.json();
      setBusy(false);

      if (!response.ok) {
        setMessage({ type: "error", text: result.error ?? "นำเข้าไม่สำเร็จ" });
        return;
      }

      setSuccessData({
        quizId: result.quizId,
        title: result.title || title,
        count: result.count,
      });
      setMessage({
        type: "success",
        text: `นำเข้าชุดข้อสอบ "${result.title || title}" สำเร็จเรียบร้อย (${result.count} ข้อ)`,
      });
      setFile(null);
      setTitle("");
      setDescription("");
      setPreviewRows([]);
    } catch {
      setBusy(false);
      setMessage({ type: "error", text: "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์" });
    }
  }

  return (
    <div>
      {message && (
        <div className={`alert alert-${message.type} mb-4`}>
          {message.text}
        </div>
      )}

      {successData && (
        <div className="card" style={{ background: "var(--success-bg)", border: "1px solid #86efac", marginBottom: "20px" }}>
          <h3 style={{ color: "var(--success)" }}>🎉 นำเข้าชุดข้อสอบเรียบร้อยแล้ว!</h3>
          <p>
            ชุดข้อสอบ <strong>{successData.title}</strong> มีจำนวน <strong>{successData.count}</strong> ข้อ พร้อมใช้งาน
          </p>
          <div className="flex gap-2 mt-2">
            <Link href="/admin" className="btn btn-primary btn-sm">
              ไปที่แผงผู้ดูแลเพื่อเปิดสอบ (Admin Dashboard) →
            </Link>
            <Link href={`/exam/${successData.quizId}`} target="_blank" className="btn btn-secondary btn-sm">
              เปิดหน้าทำข้อสอบ ↗
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={submit}>
        <div className="field">
          <label>
            ชื่อชุดข้อสอบ <span className="error">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
            placeholder="เช่น แบบทดสอบระบบเครือข่ายคอมพิวเตอร์ ชุดที่ 1"
          />
        </div>

        <div className="field">
          <label>คำอธิบายเพิ่มเติม (ไม่บังคับ)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder="รายละเอียดข้อสอบ เช่น เวลาสอบ เกณฑ์คะแนน หรือคำชี้แจง..."
          />
        </div>

        <div className="field">
          <label>
            เลือกไฟล์ CSV <span className="error">*</span>
          </label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            required={!successData}
          />
          <small className="muted">
            ขนาดไฟล์ไม่เกิน 2 MB · รองรับ UTF-8 / UTF-8 with BOM · บรรทัดแรกต้องมีคอลัมน์ <code>question,choice_a,choice_b,choice_c,choice_d,answer</code>
          </small>
        </div>

        {/* File Preview */}
        {previewRows.length > 0 && (
          <div style={{ margin: "16px 0", padding: "12px", background: "var(--bg)", borderRadius: "8px" }}>
            <div className="flex justify-between items-center mb-2">
              <strong style={{ fontSize: "0.9rem" }}>ตัวอย่างข้อมูลที่ตรวจพบ (4 แถวแรก):</strong>
              <span className="badge badge-info">{file?.name} ({(file ? file.size / 1024 : 0).toFixed(1)} KB)</span>
            </div>
            <div className="table-wrap">
              <table style={{ fontSize: "0.8rem" }}>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx} style={{ background: idx === 0 ? "var(--primary-light)" : undefined }}>
                      <td style={{ fontWeight: idx === 0 ? 700 : 500, width: "30px" }}>{idx === 0 ? "หัว" : idx}</td>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {previewError && <div className="alert alert-error">{previewError}</div>}

        <div className="flex gap-2 items-center mt-4">
          <button disabled={busy || !file} type="submit" className="btn btn-primary">
            {busy ? (
              <>
                <span className="spinner mr-2" /> กำลังตรวจสอบและนำเข้า...
              </>
            ) : (
              "🚀 ตรวจสอบและนำเข้าข้อสอบ CSV"
            )}
          </button>
          <Link href="/admin" className="btn btn-secondary">
            ยกเลิก / กลับ
          </Link>
        </div>
      </form>
    </div>
  );
}
