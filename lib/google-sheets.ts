import "server-only";

/** Sanitize a cell value against spreadsheet formula injection */
function safeCell(value: unknown): string {
  const text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) return "'" + text;
  return text;
}

interface SheetPayload {
  attemptId: string;
  quizTitle: string;
  firstName: string;
  lastName: string;
  studentId: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  percentage: number;
  submittedAt: string;
}

interface SheetResult {
  ok: boolean;
  duplicate?: boolean;
  error?: string;
}

/**
 * Send exam results to Google Sheets via Google Apps Script webhook.
 * Returns the result of the webhook call.
 */
export async function sendToGoogleSheets(
  payload: SheetPayload
): Promise<SheetResult> {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const webhookSecret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;

  if (!webhookUrl) {
    return { ok: false, error: "GOOGLE_SHEETS_WEBHOOK_URL is not configured" };
  }

  const body = {
    secret: webhookSecret ?? "",
    attemptId: payload.attemptId,
    quizTitle: safeCell(payload.quizTitle),
    firstName: safeCell(payload.firstName),
    lastName: safeCell(payload.lastName),
    studentId: safeCell(payload.studentId),
    score: payload.score,
    total: payload.totalQuestions,
    correctCount: payload.correctCount,
    wrongCount: payload.wrongCount,
    percentage: payload.percentage,
    submittedAt: payload.submittedAt,
  };

  const maxRetries = 2;
  let lastError: string = "unknown";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      if (response.ok) {
        const result = await response.json().catch(() => ({}));
        if (result.ok === true) {
          return { ok: true, duplicate: result.duplicate === true };
        }
        lastError = result.error ?? "Unknown response from Apps Script";
      } else {
        lastError = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Network error";
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  return { ok: false, error: lastError };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateSheetStatus(
  db: { from: (table: string) => any },
  attemptId: string,
  status: "pending" | "success" | "failed",
  error?: string
): Promise<void> {
  await db
    .from("attempts")
    .update({
      google_sheets_status: status,
      google_sheets_error: error ?? null,
    })
    .eq("id", attemptId);
}
