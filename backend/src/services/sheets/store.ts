import { randomUUID } from "crypto";
import type { sheets_v4 } from "googleapis";
import type { SheetsApi } from "./api";
import type { CellValue } from "./client";
import type { SheetsMirror } from "./mirror";
import {
  COL,
  MENU_TAB,
  ORDER_HEADER,
  ORDER_LAST_COLUMN,
  columnLetter,
  dayTabName,
  formatOrderText,
  manualOrderId,
  quoteTab,
  safeText,
  statusToCheckboxes,
  str,
  type ApiMenuItem,
  type ApiOrder,
  type OrderStatus,
  type ParsedOrder,
  type StoredOrderItem,
} from "./model";

const STAMP_RETRY_COOLDOWN_MS = 60_000;

/** The caller sent something we won't write to the sheet (maps to HTTP 400). */
export class OrderValidationError extends Error {}
/** No such order in the recent tabs (maps to 404). */
export class OrderNotFoundError extends Error {}
/** No such menu item (maps to 404). */
export class MenuItemNotFoundError extends Error {}
/** A worker re-sorted the sheet under us and the row can't be trusted (maps to 409). */
export class RowMovedError extends Error {}

export interface NewOrderInput {
  netId: string;
  phone?: string | null;
  items: Array<{ menuItemId: string; quantity: number; modifiers?: string[] }>;
}

export interface OrderPatch {
  status?: OrderStatus;
  comments?: string;
  paid?: boolean;
  paymentId?: string;
}

/**
 * Google accounts allowed to edit protected ranges: the admins in SHEETS_ADMIN_EMAILS plus the
 * service account itself (which must stay an editor or the backend loses write access).
 * Returns null when no admins are configured, in which case nothing is protected.
 */
export function protectionEditors(): string[] | null {
  const admins = (process.env.SHEETS_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  if (!admins.length) return null;
  const serviceAccount = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  return serviceAccount ? [...new Set([...admins, serviceAccount])] : admins;
}

/** Workers can edit columns A-G freely; the backend-owned helper columns (ID, total, Clover ID, ...) are admin-only. */
function helperColumnProtection(sheetId: number): sheets_v4.Schema$Request[] {
  const editors = protectionEditors();
  if (!editors) return [];
  return [
    {
      addProtectedRange: {
        protectedRange: {
          range: { sheetId, startColumnIndex: COL.orderId, endColumnIndex: COL.cancelled + 1 },
          description: "BlueBite backend columns - do not edit by hand",
          editors: { users: editors },
        },
      },
    },
  ];
}

function cell(value: string | number | boolean, checkbox = false): sheets_v4.Schema$CellData {
  const c: sheets_v4.Schema$CellData = {};
  if (typeof value === "boolean") c.userEnteredValue = { boolValue: value };
  else if (typeof value === "number") c.userEnteredValue = { numberValue: value };
  else if (value !== "") c.userEnteredValue = { stringValue: value }; // stringValue is literal, never parsed as a formula
  if (checkbox) c.dataValidation = { condition: { type: "BOOLEAN" } };
  return c;
}

/**
 * All writes to the sheet go through one FIFO queue, so this process never races
 * itself (concurrent appendCells calls are documented to overwrite each other).
 * Each write is followed by a mirror refresh, so callers read their own writes
 * and SSE events come from the same diff path as worker edits.
 */
export class SheetsStore {
  private queue: Promise<unknown> = Promise.resolve();
  private stampPending = false;
  private stampBlockedUntil = 0;

  constructor(private api: SheetsApi, private mirror: SheetsMirror) {
    mirror.onRefreshed(() => this.stampManualRows());
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined); // a failed write must not wedge the queue
    return run;
  }

  // ---- Orders -------------------------------------------------------------

  /** Prices come from the menu mirror, never from the client: this is what gets charged. */
  private priceOrder(input: NewOrderInput["items"]): { items: StoredOrderItem[]; total: number } {
    let total = 0;
    const items = input.map((line): StoredOrderItem => {
      const quantity = Math.max(1, Math.floor(Number(line.quantity) || 1));
      const menuItem = this.mirror.getMenuItem(line.menuItemId);
      if (!menuItem) throw new OrderValidationError(`Unknown menu item: ${line.menuItemId}`);
      if (!menuItem.available) throw new OrderValidationError(`${menuItem.name} is currently unavailable`);

      const modifiers = (line.modifiers ?? [])
        .map((name) => menuItem.modifiers.find((m) => m.name === name))
        .filter((m): m is NonNullable<typeof m> => Boolean(m))
        .map((m) => ({ name: m.name, price: m.price }));

      const unitPrice = menuItem.price + modifiers.reduce((sum, m) => sum + m.price, 0);
      total += unitPrice * quantity;
      return { menuItemId: menuItem.id, name: menuItem.name, quantity, price: unitPrice, modifiers };
    });
    return { items, total: Math.round(total * 100) / 100 };
  }

  async createOrder(input: NewOrderInput): Promise<ApiOrder> {
    if (!input.netId) throw new OrderValidationError("Missing required field: netId");
    if (!input.items?.length) throw new OrderValidationError("Order must contain at least one item");

    const { items, total } = this.priceOrder(input.items);
    const id = randomUUID();
    const row: sheets_v4.Schema$CellData[] = [];
    row[COL.name] = cell(input.netId);
    row[COL.order] = cell(formatOrderText(items));
    row[COL.done] = cell(false, true);
    row[COL.paid] = cell(false, true);
    row[COL.pickedUp] = cell(false, true);
    row[COL.phone] = cell(input.phone ?? "");
    row[COL.comments] = cell("");
    row[COL.orderId] = cell(id);
    row[COL.netId] = cell(input.netId);
    row[COL.total] = cell(total);
    row[COL.paymentId] = cell("");
    row[COL.submittedAt] = cell(new Date().toISOString());
    row[COL.itemsJson] = cell(JSON.stringify(items));
    row[COL.cancelled] = cell(false, true);
    for (let i = 0; i < ORDER_HEADER.length; i++) row[i] ??= {};

    await this.enqueue(async () => {
      const sheetId = await this.ensureDayTab(dayTabName());
      await this.api.batchUpdate([
        { appendCells: { sheetId, rows: [{ values: row }], fields: "userEnteredValue,dataValidation" } },
      ]);
    });

    await this.mirror.refresh();
    const created = this.mirror.getOrder(id);
    if (!created) throw new Error("Order was written but not found on re-read");
    return created.order;
  }

  async updateOrder(orderId: string, patch: OrderPatch): Promise<ApiOrder> {
    await this.enqueue(async () => {
      const parsed = this.mirror.getOrder(orderId);
      if (!parsed) throw new OrderNotFoundError(orderId);
      const rowNumber = await this.locateRow(parsed);

      const tab = quoteTab(parsed.tab);
      const data: Array<{ range: string; values: CellValue[][] }> = [];
      const put = (col: number, value: CellValue) =>
        data.push({ range: `${tab}!${columnLetter(col)}${rowNumber}`, values: [[value]] });

      const boxes = patch.status ? statusToCheckboxes(patch.status) : {};
      if (boxes.done !== undefined) put(COL.done, boxes.done);
      if (boxes.pickedUp !== undefined) put(COL.pickedUp, boxes.pickedUp);
      if (boxes.cancelled !== undefined) put(COL.cancelled, boxes.cancelled);
      if (patch.paid !== undefined) put(COL.paid, patch.paid);
      if (patch.paymentId !== undefined) put(COL.paymentId, safeText(patch.paymentId));
      if (patch.comments !== undefined) put(COL.comments, safeText(patch.comments));

      if (data.length) await this.api.batchUpdateValues(data);
    });

    await this.mirror.refresh();
    const updated = this.mirror.getOrder(orderId);
    if (!updated) throw new OrderNotFoundError(orderId);
    return updated.order;
  }

  /** Called by the payment flow once Clover reports success (or an admin bypasses). */
  markPaid(orderId: string, paymentId: string): Promise<ApiOrder> {
    return this.updateOrder(orderId, { paid: true, paymentId });
  }

  // ---- Menu ---------------------------------------------------------------

  /** Staff toggle for availability / hot. Everything else on the menu is edited in the sheet. */
  async setMenuFlags(itemId: string, flags: { available?: boolean; hot?: boolean }): Promise<ApiMenuItem> {
    await this.enqueue(async () => {
      if (!this.mirror.getMenuItem(itemId)) throw new MenuItemNotFoundError(itemId);
      const [names] = await this.api.batchGetValues([`${quoteTab(MENU_TAB)}!A:A`]);
      const idx = names.findIndex((r, i) => i > 0 && str(r[0]) === itemId);
      if (idx < 0) throw new MenuItemNotFoundError(itemId);

      const data: Array<{ range: string; values: CellValue[][] }> = [];
      if (flags.available !== undefined) data.push({ range: `${quoteTab(MENU_TAB)}!E${idx + 1}`, values: [[flags.available]] });
      if (flags.hot !== undefined) data.push({ range: `${quoteTab(MENU_TAB)}!F${idx + 1}`, values: [[flags.hot]] });
      if (data.length) await this.api.batchUpdateValues(data);
    });

    await this.mirror.refresh();
    const item = this.mirror.getMenuItem(itemId);
    if (!item) throw new MenuItemNotFoundError(itemId);
    return item;
  }

  // ---- Internals ----------------------------------------------------------

  /**
   * The mirror's row number can be stale (a worker may have sorted since the last
   * poll), so the row is re-found by OrderID immediately before writing.
   */
  private async locateRow(parsed: ParsedOrder): Promise<number> {
    const [rows] = await this.api.batchGetValues([`${quoteTab(parsed.tab)}!A:${columnLetter(COL.orderId)}`]);
    const idx = rows.findIndex((r) => str(r[COL.orderId]) === parsed.order.id);
    if (idx >= 0) return idx + 1;

    if (!parsed.stamped) {
      // Hand-typed row that hasn't been given an ID yet: trust its position only if it still holds the same text.
      const r = rows[parsed.row - 1];
      const sameText =
        r && !str(r[COL.orderId]) &&
        str(r[COL.name]) === parsed.order.netId &&
        str(r[COL.order]) === parsed.order.orderItems[0]?.name;
      if (sameText) return parsed.row;
      throw new RowMovedError(`Row for ${parsed.order.id} moved; refresh and retry`);
    }
    throw new OrderNotFoundError(parsed.order.id);
  }

  private async ensureDayTab(tab: string): Promise<number> {
    const known = this.mirror.getSheetId(tab);
    if (known !== undefined) return known;

    const find = async () => (await this.api.getTabs()).find((t) => t.title === tab)?.sheetId;
    let sheetId = await find();
    if (sheetId === undefined) {
      try {
        // Choosing the sheetId up front lets the protection be added in the same atomic batch.
        const newSheetId = Math.floor(Math.random() * 2_000_000_000) + 1;
        await this.api.batchUpdate([
          { addSheet: { properties: { sheetId: newSheetId, title: tab, gridProperties: { frozenRowCount: 1 } } } },
          ...helperColumnProtection(newSheetId),
        ]);
        await this.api.batchUpdateValues([
          { range: `${quoteTab(tab)}!A1:${ORDER_LAST_COLUMN}1`, values: [ORDER_HEADER] },
        ]);
      } catch (error) {
        // A worker may have created today's tab a moment ago; that's fine if it exists now.
        if ((await find()) === undefined) throw error;
      }
      sheetId = await find();
    }
    if (sheetId === undefined) throw new Error(`Could not create tab "${tab}"`);
    this.mirror.noteTab(tab, sheetId);
    return sheetId;
  }

  /**
   * Hand-typed rows have no OrderID. Write "manual:<tab>:<row>" into the ID column
   * so the order keeps a stable identity when workers sort or filter the sheet.
   */
  private stampManualRows(): void {
    if (this.stampPending || Date.now() < this.stampBlockedUntil) return;
    const tabs = new Set(this.mirror.getParsedOrders().filter((p) => !p.stamped).map((p) => p.tab));
    if (!tabs.size) return;

    this.stampPending = true;
    this.enqueue(async () => {
      for (const tab of tabs) {
        const [rows] = await this.api.batchGetValues([`${quoteTab(tab)}!A:${columnLetter(COL.orderId)}`]);
        const data: Array<{ range: string; values: CellValue[][] }> = [];
        rows.forEach((r, i) => {
          if (i === 0 || str(r[COL.orderId])) return;
          if (!str(r[COL.name]) && !str(r[COL.order])) return;
          data.push({
            range: `${quoteTab(tab)}!${columnLetter(COL.orderId)}${i + 1}`,
            values: [[manualOrderId(tab, i + 1)]],
          });
        });
        if (data.length) await this.api.batchUpdateValues(data);
      }
    })
      .then(() => this.mirror.requestRefresh())
      .catch((error) => {
        // Likely a protected range or quota problem: back off rather than retry on every poll.
        this.stampBlockedUntil = Date.now() + STAMP_RETRY_COOLDOWN_MS;
        console.error("[Sheets] Failed to stamp hand-typed rows:", error);
      })
      .finally(() => {
        this.stampPending = false;
      });
  }
}
