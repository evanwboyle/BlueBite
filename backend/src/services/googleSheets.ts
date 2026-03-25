import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");

// Column layout: Name | Order | Done | Picked Up | Phone Number | Comments | OrderID (hidden) | Submitted By
const HEADER_ROW = ["Name", "Order", "Done", "Picked Up", "Phone Number", "Comments", "OrderID", "Submitted By"];

function getAuth() {
  if (!CLIENT_EMAIL || !PRIVATE_KEY) {
    return null;
  }
  return new google.auth.JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY,
    scopes: SCOPES,
  });
}

function getSheetName(): string {
  const now = new Date();
  return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
}

interface OrderForSheet {
  id: string;
  netId: string;
  status: string;
  phone?: string | null;
  orderItems: Array<{
    name?: string | null;
    quantity: number;
    modifiers: Array<{
      name?: string | null;
    }>;
  }>;
}

function formatOrderString(order: OrderForSheet): string {
  return order.orderItems
    .map((item) => {
      const mods = item.modifiers
        .filter((m) => m.name)
        .map((m) => m.name)
        .join(", ");
      const qty = item.quantity > 1 ? `${item.quantity}x ` : "";
      return mods ? `${qty}${item.name} (${mods})` : `${qty}${item.name}`;
    })
    .join("; ");
}

async function ensureDayTab(sheets: ReturnType<typeof google.sheets>, sheetName: string): Promise<void> {
  if (!SPREADSHEET_ID) return;

  // Check if tab already exists
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingSheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );

  if (!existingSheet) {
    // Create the tab
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: sheetName },
            },
          },
        ],
      },
    });

    // Add header row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A1:H1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [HEADER_ROW],
      },
    });
  }
}

export async function syncOrderToSheet(order: OrderForSheet, submittedBy?: string): Promise<void> {
  const auth = getAuth();
  if (!auth || !SPREADSHEET_ID) {
    console.log("[Google Sheets] Sync disabled (missing credentials or spreadsheet ID)");
    return;
  }

  try {
    const sheets = google.sheets({ version: "v4", auth });
    const sheetName = getSheetName();

    await ensureDayTab(sheets, sheetName);

    const row = [
      order.netId,
      formatOrderString(order),
      "", // Done
      "", // Picked Up
      order.phone || "",
      "", // Comments
      order.id,
      submittedBy || "",
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A:H`,
      valueInputOption: "RAW",
      requestBody: {
        values: [row],
      },
    });

    console.log(`[Google Sheets] Order ${order.id} synced to tab "${sheetName}"`);
  } catch (error) {
    console.error("[Google Sheets] Failed to sync order:", error);
  }
}

export async function updateOrderStatusInSheet(orderId: string, status: string): Promise<void> {
  const auth = getAuth();
  if (!auth || !SPREADSHEET_ID) return;

  try {
    const sheets = google.sheets({ version: "v4", auth });
    const sheetName = getSheetName();

    // Read all rows to find the order by ID (column G)
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A:G`,
    });

    const rows = result.data.values;
    if (!rows) return;

    // Find the row with matching order ID (column G = index 6)
    const rowIndex = rows.findIndex((row) => row[6] === orderId);
    if (rowIndex === -1) {
      console.log(`[Google Sheets] Order ${orderId} not found in tab "${sheetName}"`);
      return;
    }

    const isDone = ["ready", "completed", "cancelled"].includes(status);
    const isPickedUp = status === "completed";

    // Update Done (column C) and Picked Up (column D)
    const rowNum = rowIndex + 1; // Sheets is 1-indexed
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!C${rowNum}:D${rowNum}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[isDone ? "Yes" : "", isPickedUp ? "Yes" : ""]],
      },
    });

    console.log(`[Google Sheets] Order ${orderId} status updated to "${status}"`);
  } catch (error) {
    console.error("[Google Sheets] Failed to update order status:", error);
  }
}

export async function updateOrderCommentsInSheet(orderId: string, comments: string): Promise<void> {
  const auth = getAuth();
  if (!auth || !SPREADSHEET_ID) return;

  try {
    const sheets = google.sheets({ version: "v4", auth });
    const sheetName = getSheetName();

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A:H`,
    });

    const rows = result.data.values;
    if (!rows) return;

    const rowIndex = rows.findIndex((row) => row[6] === orderId);
    if (rowIndex === -1) {
      console.log(`[Google Sheets] Order ${orderId} not found in tab "${sheetName}"`);
      return;
    }

    const rowNum = rowIndex + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!F${rowNum}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[comments]],
      },
    });

    console.log(`[Google Sheets] Order ${orderId} comments updated`);
  } catch (error) {
    console.error("[Google Sheets] Failed to update order comments:", error);
  }
}
