import { realSheetsApi } from "./api";
import { SheetsMirror, type EmitFn } from "./mirror";
import { SheetsStore } from "./store";

const POLL_INTERVAL_MS = 5_000;

/** STORE=sheets switches the API from Postgres to the Google Sheet. Evaluated at call time (dotenv loads after imports). */
export function useSheets(): boolean {
  return process.env.STORE === "sheets";
}

let instance: { mirror: SheetsMirror; store: SheetsStore } | null = null;

/** Creates the singleton mirror + store (no I/O), so routes can be mounted before the first load. */
export function initSheets(emit: EmitFn): { mirror: SheetsMirror; store: SheetsStore } {
  const mirror = new SheetsMirror(realSheetsApi, emit, {
    imageBaseUrl: process.env.SERVER_BASE_URL || "http://localhost:3000",
  });
  const store = new SheetsStore(realSheetsApi, mirror);
  instance = { mirror, store };
  return instance;
}

/** First load, then start polling. Throws if the sheet can't be read: better to fail at boot than serve an empty menu. */
export async function startSheets(): Promise<void> {
  const { mirror } = getSheets();
  await mirror.refresh(); // roles must be loaded before anyone can log in
  mirror.start(POLL_INTERVAL_MS);
  console.log(
    `[Sheets] Loaded ${mirror.getMenu().length} menu items and ${mirror.getOrders().length} recent orders; polling every ${POLL_INTERVAL_MS / 1000}s`
  );
}

export function getSheets(): { mirror: SheetsMirror; store: SheetsStore } {
  if (!instance) throw new Error("Sheets store not initialised (STORE=sheets but initSheets() has not run)");
  return instance;
}
