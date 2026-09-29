// Pure data layer for the Sheets-backed store: sheet layout, row parsing, and
// status derivation. No I/O so it can be unit tested directly.

export const BUTTERY_NAME = "Benjamin Franklin";
export const SHEET_TIMEZONE = "America/New_York";

export const MENU_TAB = "Menu";
export const MODIFIERS_TAB = "Modifiers";
export const ROLES_TAB = "Roles";

export type Cell = string | number | boolean | null | undefined;

// ---- Column layout -------------------------------------------------------

// Menu: Name | Description | Price | Category | Available | Hot | Image URL | Archived
export const MENU_HEADER = ["Name", "Description", "Price", "Category", "Available", "Hot", "Image URL", "Archived"];

// Modifiers: Item | Group | GroupRequired | Min | Max | Modifier | Price | Available | Description
export const MODIFIERS_HEADER = [
  "Item", "Group", "GroupRequired", "Min", "Max", "Modifier", "Price", "Available", "Description",
];

// Roles: NetID | Role | Google Email
export const ROLES_HEADER = ["NetID", "Role", "Google Email"];

// Daily tab: workers' columns (A-G) followed by backend-owned helper columns (H-N).
export const ORDER_HEADER = [
  "Name", "Order", "Done", "Paid", "Picked Up", "Phone Number", "Comments",
  "OrderID", "NetID", "Total", "Clover Payment ID", "Submitted At", "Items JSON", "Cancelled",
];

export const COL = {
  name: 0,
  order: 1,
  done: 2,
  paid: 3,
  pickedUp: 4,
  phone: 5,
  comments: 6,
  orderId: 7,
  netId: 8,
  total: 9,
  paymentId: 10,
  submittedAt: 11,
  itemsJson: 12,
  cancelled: 13,
} as const;

export function columnLetter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

export const ORDER_LAST_COLUMN = columnLetter(ORDER_HEADER.length - 1);

/** Quotes a tab name for use in an A1 range. */
export function quoteTab(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

// ---- Cell coercion -------------------------------------------------------

export function str(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  return String(cell).trim();
}

/**
 * Free text (comments, IDs) is written with USER_ENTERED so checkboxes work, which
 * means Sheets would evaluate a leading "=" as a formula (e.g. IMPORTXML to leak
 * data). A leading apostrophe forces the cell to plain text.
 */
export function safeText(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function num(cell: Cell, fallback = 0): number {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : fallback;
  const parsed = parseFloat(str(cell).replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Checkboxes arrive as booleans; hand-typed values like "yes"/"x" are accepted too. */
export function bool(cell: Cell, fallback = false): boolean {
  if (typeof cell === "boolean") return cell;
  if (typeof cell === "number") return cell !== 0;
  const s = str(cell).toLowerCase();
  if (s === "") return fallback;
  return ["true", "yes", "y", "x", "1", "✓", "✔"].includes(s);
}

// ---- Tab names / dates ---------------------------------------------------

/** Daily tab name (M/D/YYYY, no zero padding) for the buttery's local day. */
export function dayTabName(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SHEET_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

const DAY_TAB_PATTERN = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

export function isDayTab(title: string): boolean {
  return DAY_TAB_PATTERN.test(title);
}

/** Approximate timestamp for a day tab (midday Eastern), used for hand-typed rows with no Submitted At. */
export function dayTabDate(tab: string): Date {
  const [m, d, y] = tab.split("/").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 17));
}

// ---- Menu ----------------------------------------------------------------

export const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{10,}$/;

/**
 * Pulls the file ID out of a pasted Google Drive link (share link, open?id=, uc?id=, thumbnail?id=,
 * lh3.googleusercontent.com/d/ID). Returns null for anything else, including folder links and
 * non-Google URLs, which are used as-is.
 */
export function extractDriveFileId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.hostname === "drive.google.com" || url.hostname === "docs.google.com") {
    const m = url.pathname.match(/\/d\/([A-Za-z0-9_-]{10,})/);
    if (m) return m[1];
    const id = url.searchParams.get("id");
    return id && DRIVE_FILE_ID.test(id) ? id : null;
  }
  if (url.hostname === "lh3.googleusercontent.com") {
    return url.pathname.match(/^\/d\/([A-Za-z0-9_-]{10,})/)?.[1] ?? null;
  }
  return null;
}

export const IMAGE_ROUTE = "/api/images/";

/** Drive links become a URL on our own server (which fetches the file with the service account); other URLs pass through. */
export function resolveImageUrl(raw: string, imageBaseUrl?: string): string | null {
  if (!raw) return null;
  const id = imageBaseUrl ? extractDriveFileId(raw) : null;
  return id ? `${imageBaseUrl!.replace(/\/$/, "")}${IMAGE_ROUTE}${id}` : raw;
}

export interface ApiModifier {
  id: string;
  name: string;
  description: string | null;
  price: number;
  menuItemId: string;
  modifierGroupId: string | null;
  available: boolean;
  archived: boolean;
}

export interface ApiModifierGroup {
  id: string;
  name: string;
  menuItemId: string;
  required: boolean;
  minSelections: number;
  maxSelections: number | null;
  displayOrder: number;
  modifiers: ApiModifier[];
}

export interface ApiMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  available: boolean;
  hot: boolean;
  buttery: string;
  image: string | null;
  archived: boolean;
  modifiers: ApiModifier[];
  modifierGroups: ApiModifierGroup[];
}

/**
 * Menu items and modifiers have no ID column: workers only edit names and
 * prices. An item's ID is its name, so renaming an item in the sheet makes it
 * a new item (past orders are unaffected because they snapshot names/prices).
 */
export function parseMenu(
  menuRows: Cell[][],
  modifierRows: Cell[][],
  opts: { imageBaseUrl?: string } = {}
): ApiMenuItem[] {
  const items = new Map<string, ApiMenuItem>();

  for (const row of menuRows.slice(1)) {
    const name = str(row[0]);
    if (!name || items.has(name)) continue;
    const archived = bool(row[7], false);
    if (archived) continue;
    items.set(name, {
      id: name,
      name,
      description: str(row[1]) || null,
      price: num(row[2]),
      category: str(row[3]) || "Main",
      available: bool(row[4], true),
      hot: bool(row[5], false),
      buttery: BUTTERY_NAME,
      image: resolveImageUrl(str(row[6]), opts.imageBaseUrl),
      archived: false,
      modifiers: [],
      modifierGroups: [],
    });
  }

  for (const row of modifierRows.slice(1)) {
    const itemName = str(row[0]);
    const modName = str(row[5]);
    const item = items.get(itemName);
    if (!item || !modName) continue;

    const available = bool(row[7], true);
    if (!available) continue; // unavailable modifiers are hidden from customers

    const groupName = str(row[1]);
    let group: ApiModifierGroup | undefined;
    if (groupName) {
      group = item.modifierGroups.find((g) => g.name === groupName);
      if (!group) {
        const min = Math.max(0, Math.floor(num(row[3], 0)));
        const maxCell = str(row[4]);
        group = {
          id: `${itemName}::${groupName}`,
          name: groupName,
          menuItemId: item.id,
          required: bool(row[2], false),
          minSelections: min,
          maxSelections: maxCell === "" ? null : Math.max(0, Math.floor(num(row[4], 0))),
          displayOrder: item.modifierGroups.length,
          modifiers: [],
        };
        item.modifierGroups.push(group);
      }
    }

    const modifier: ApiModifier = {
      id: `${itemName}::${groupName}::${modName}`,
      name: modName,
      description: str(row[8]) || null,
      price: num(row[6]),
      menuItemId: item.id,
      modifierGroupId: group?.id ?? null,
      available: true,
      archived: false,
    };
    item.modifiers.push(modifier);
    group?.modifiers.push(modifier);
  }

  return [...items.values()];
}

// ---- Roles ---------------------------------------------------------------

export type Role = "customer" | "staff" | "admin";

export function parseRoles(rows: Cell[][]): Map<string, Role> {
  const roles = new Map<string, Role>();
  for (const row of rows.slice(1)) {
    const netId = str(row[0]).toLowerCase();
    const role = str(row[1]).toLowerCase();
    if (netId && (role === "staff" || role === "admin")) roles.set(netId, role);
  }
  return roles;
}

// ---- Orders --------------------------------------------------------------

export type OrderStatus =
  | "awaiting_payment"
  | "payment_failed"
  | "pending"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export interface StoredOrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number; // unit price including modifiers
  modifiers: Array<{ name: string; price: number }>;
}

export interface ApiOrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  modifiers: Array<{ id: string; name: string; price: number; modifier: { id: string; name: string; price: number } }>;
}

export interface ApiOrder {
  id: string;
  netId: string;
  buttery: string;
  status: OrderStatus;
  totalPrice: number;
  comments: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  orderItems: ApiOrderItem[];
}

/** A daily-tab row, parsed. `tab` and `row` say where it lives (row is 1-indexed and can go stale if workers sort). */
export interface ParsedOrder {
  order: ApiOrder;
  tab: string;
  row: number;
  /** Hand-typed by a worker: no structured items. Display-only. */
  manual: boolean;
  /** The OrderID cell is filled in. Hand-typed rows start unstamped and get an ID written back. */
  stamped: boolean;
  paid: boolean;
  paymentId: string;
}

export function deriveStatus(f: {
  paid: boolean;
  done: boolean;
  pickedUp: boolean;
  cancelled: boolean;
  manual: boolean;
}): OrderStatus {
  if (f.cancelled) return "cancelled";
  if (f.pickedUp) return "completed";
  if (f.done) return "ready";
  if (f.paid || f.manual) return "pending"; // hand-typed orders are never "awaiting payment"
  return "awaiting_payment";
}

export interface CheckboxUpdate {
  done?: boolean;
  pickedUp?: boolean;
  cancelled?: boolean;
}

/**
 * Checkbox changes implied by moving an order to `status`. Paid is deliberately
 * absent: it is only ever set by a successful payment (or an admin bypass).
 * `preparing` has no column, so it collapses to `pending`.
 */
export function statusToCheckboxes(status: OrderStatus): CheckboxUpdate {
  switch (status) {
    case "pending":
    case "preparing":
      return { done: false, pickedUp: false, cancelled: false };
    case "ready":
      return { done: true, pickedUp: false, cancelled: false };
    case "completed":
      return { done: true, pickedUp: true, cancelled: false };
    case "cancelled":
      return { cancelled: true };
    default:
      return {}; // awaiting_payment / payment_failed follow from Paid
  }
}

function parseItemsJson(raw: string): StoredOrderItem[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredOrderItem[]) : null;
  } catch {
    return null;
  }
}

export function formatOrderText(items: StoredOrderItem[]): string {
  return items
    .map((item) => {
      const mods = item.modifiers.map((m) => m.name).filter(Boolean).join(", ");
      const qty = item.quantity > 1 ? `${item.quantity}x ` : "";
      return mods ? `${qty}${item.name} (${mods})` : `${qty}${item.name}`;
    })
    .join("; ");
}

function toApiItems(orderId: string, items: StoredOrderItem[]): ApiOrderItem[] {
  return items.map((item, i) => ({
    id: `${orderId}:${i}`,
    orderId,
    menuItemId: item.menuItemId,
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    modifiers: (item.modifiers ?? []).map((m, j) => ({
      id: `${orderId}:${i}:${j}`,
      name: m.name,
      price: m.price,
      modifier: { id: `${orderId}:${i}:${j}`, name: m.name, price: m.price },
    })),
  }));
}

/** Synthetic ID for a hand-typed row until the backend stamps a real OrderID onto it. */
export function manualOrderId(tab: string, row: number): string {
  return `manual:${tab}:${row}`;
}

export function parseOrderRow(row: Cell[], tab: string, rowNumber: number): ParsedOrder | null {
  const orderId = str(row[COL.orderId]);
  const name = str(row[COL.name]);
  const orderText = str(row[COL.order]);
  if (!orderId && !name && !orderText) return null; // blank row

  // A stamped hand-typed row keeps its synthetic "manual:..." ID so it stays stable after sorts.
  const manual = !orderId || orderId.startsWith("manual:");
  const id = orderId || manualOrderId(tab, rowNumber);

  const stored = parseItemsJson(str(row[COL.itemsJson]));
  const items: StoredOrderItem[] =
    stored ??
    (orderText
      ? [{ menuItemId: "manual", name: orderText, quantity: 1, price: 0, modifiers: [] }]
      : []);

  const submittedAt = str(row[COL.submittedAt]);
  const createdAt = submittedAt && !Number.isNaN(Date.parse(submittedAt))
    ? new Date(submittedAt)
    : dayTabDate(tab);

  const paid = bool(row[COL.paid]);
  const status = deriveStatus({
    paid,
    done: bool(row[COL.done]),
    pickedUp: bool(row[COL.pickedUp]),
    cancelled: bool(row[COL.cancelled]),
    manual,
  });

  return {
    tab,
    row: rowNumber,
    manual,
    stamped: orderId !== "",
    paid,
    paymentId: str(row[COL.paymentId]),
    order: {
      id,
      netId: str(row[COL.netId]) || name,
      buttery: BUTTERY_NAME,
      status,
      totalPrice: manual ? 0 : num(row[COL.total]),
      comments: str(row[COL.comments]) || null,
      phone: str(row[COL.phone]) || null,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      orderItems: toApiItems(id, items),
    },
  };
}
