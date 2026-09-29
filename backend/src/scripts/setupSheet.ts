/**
 * One-time bootstrap for the Google Sheet that backs BlueBite (STORE=sheets).
 *
 * Creates the Menu, Modifiers and Roles tabs (headers, checkbox columns, frozen header row) and, when
 * SHEETS_ADMIN_EMAILS is set, protects them so only those Google accounts (plus the service account) can
 * edit. Existing tabs are left untouched, so it is safe to re-run. Daily order tabs are created by the
 * server itself.
 *
 *   cd backend && npm run sheet:setup
 *
 * Before running: share the spreadsheet with GOOGLE_SHEETS_CLIENT_EMAIL as an Editor.
 */
import dotenv from "dotenv";
import type { sheets_v4 } from "googleapis";
import { getSheetsClient, isSheetsConfigured } from "../services/sheets/client";
import { MENU_HEADER, MENU_TAB, MODIFIERS_HEADER, MODIFIERS_TAB, ROLES_HEADER, ROLES_TAB, quoteTab, columnLetter } from "../services/sheets/model";
import { protectionEditors } from "../services/sheets/store";

dotenv.config();

interface TabSpec {
  title: string;
  header: string[];
  checkboxColumns: number[]; // 0-indexed
  /** Columns left editable for everyone with sheet access (e.g. staff toggling Available/Hot). */
  unprotectedColumns?: number[];
}

const TABS: TabSpec[] = [
  { title: MENU_TAB, header: MENU_HEADER, checkboxColumns: [4, 5, 7], unprotectedColumns: [4, 5] },
  { title: MODIFIERS_TAB, header: MODIFIERS_HEADER, checkboxColumns: [2, 7] },
  { title: ROLES_TAB, header: ROLES_HEADER, checkboxColumns: [] },
];

const MAX_ROWS = 1000;

async function main() {
  if (!isSheetsConfigured()) {
    throw new Error("Set GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY first.");
  }
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const sheets = getSheetsClient();
  const editors = protectionEditors();
  if (!editors) {
    console.warn("SHEETS_ADMIN_EMAILS is not set: tabs will be created UNPROTECTED (anyone with edit access can change roles).");
  }

  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" });
  const existing = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title));

  for (const tab of TABS) {
    if (existing.has(tab.title)) {
      console.log(`= "${tab.title}" already exists, leaving it alone`);
      continue;
    }

    const sheetId = Math.floor(Math.random() * 2_000_000_000) + 1;
    const requests: sheets_v4.Schema$Request[] = [
      { addSheet: { properties: { sheetId, title: tab.title, gridProperties: { frozenRowCount: 1 } } } },
      ...tab.checkboxColumns.map((col): sheets_v4.Schema$Request => ({
        setDataValidation: {
          range: { sheetId, startRowIndex: 1, endRowIndex: MAX_ROWS, startColumnIndex: col, endColumnIndex: col + 1 },
          rule: { condition: { type: "BOOLEAN" }, strict: true },
        },
      })),
    ];
    if (editors) {
      requests.push({
        addProtectedRange: {
          protectedRange: {
            range: { sheetId },
            description: `BlueBite: ${tab.title} is admin-only`,
            editors: { users: editors },
            unprotectedRanges: (tab.unprotectedColumns ?? []).map((col) => ({
              sheetId,
              startRowIndex: 1,
              startColumnIndex: col,
              endColumnIndex: col + 1,
            })),
          },
        },
      });
    }
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteTab(tab.title)}!A1:${columnLetter(tab.header.length - 1)}1`,
      valueInputOption: "RAW",
      requestBody: { values: [tab.header] },
    });
    console.log(`+ created "${tab.title}"${editors ? ` (protected; editors: ${editors.join(", ")})` : ""}`);
  }

  console.log("\nDone. Next: `npm run sheet:migrate` to copy the menu/roles from Postgres, or type them into the tabs by hand.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
