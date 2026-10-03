import { google, sheets_v4 } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

// Read lazily: index.ts imports this module before dotenv.config() has run.
const spreadsheetId = () => process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const clientEmail = () => process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
const privateKey = () => process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");

// Google's quota is 60 reads/min and 60 writes/min per service account, so
// 429s are expected under bursts and are retried with exponential backoff.
const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 32_000;

/** Service-account credentials from env, or null when unset. Shared with the Drive image client. */
export function serviceAccount(): { email: string; key: string } | null {
  const email = clientEmail();
  const key = privateKey();
  return email && key ? { email, key } : null;
}

let cachedClient: sheets_v4.Sheets | null = null;

export function isSheetsConfigured(): boolean {
  return Boolean(spreadsheetId() && clientEmail() && privateKey());
}

export function getSheetsClient(): sheets_v4.Sheets {
  if (!isSheetsConfigured()) {
    throw new Error(
      "Google Sheets is not configured (GOOGLE_SHEETS_SPREADSHEET_ID / CLIENT_EMAIL / PRIVATE_KEY)"
    );
  }
  if (!cachedClient) {
    const auth = new google.auth.JWT({
      email: clientEmail(),
      key: privateKey(),
      scopes: SCOPES,
    });
    cachedClient = google.sheets({ version: "v4", auth });
  }
  return cachedClient;
}

function statusOf(error: unknown): number | undefined {
  const e = error as { code?: number | string; response?: { status?: number } };
  if (typeof e?.code === "number") return e.code;
  return e?.response?.status;
}

function isRetryable(error: unknown): boolean {
  const status = statusOf(error);
  return status === 429 || (status !== undefined && status >= 500);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt + 1 >= MAX_ATTEMPTS || !isRetryable(error)) {
        console.error(`[Sheets] ${label} failed (attempt ${attempt + 1}):`, error);
        throw error;
      }
      const delay = Math.min(2 ** attempt * 1000 + Math.random() * 1000, MAX_BACKOFF_MS);
      console.warn(`[Sheets] ${label} got ${statusOf(error)}, retrying in ${Math.round(delay)}ms`);
      await sleep(delay);
    }
  }
}

export type CellValue = string | number | boolean | null;

/** One request reading several ranges. Unformatted so checkboxes come back as booleans and prices as numbers. */
export async function batchGetValues(ranges: string[]): Promise<CellValue[][][]> {
  const sheets = getSheetsClient();
  const result = await withRetry("batchGet", () =>
    sheets.spreadsheets.values.batchGet({
      spreadsheetId: spreadsheetId()!,
      ranges,
      valueRenderOption: "UNFORMATTED_VALUE",
    })
  );
  return (result.data.valueRanges ?? []).map((vr) => (vr.values ?? []) as CellValue[][]);
}

export async function getSpreadsheetMeta(): Promise<sheets_v4.Schema$Sheet[]> {
  const sheets = getSheetsClient();
  const result = await withRetry("get", () =>
    sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId()!,
      fields: "sheets.properties(sheetId,title)",
    })
  );
  return result.data.sheets ?? [];
}

/** Applies all requests atomically in a single API call. */
export async function batchUpdate(requests: sheets_v4.Schema$Request[]): Promise<void> {
  const sheets = getSheetsClient();
  await withRetry("batchUpdate", () =>
    sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId()!,
      requestBody: { requests },
    })
  );
}

/** Writes several ranges in one call. Values are parsed like typed input, so TRUE/FALSE become checkbox values. */
export async function batchUpdateValues(
  data: Array<{ range: string; values: CellValue[][] }>
): Promise<void> {
  const sheets = getSheetsClient();
  await withRetry("values.batchUpdate", () =>
    sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: spreadsheetId()!,
      requestBody: { valueInputOption: "USER_ENTERED", data },
    })
  );
}
