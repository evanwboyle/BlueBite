# Google Sheets backend (`STORE=sheets`)

The Google Sheet is the system of record for one buttery (**Benjamin Franklin**): the menu, staff roles, and
each day's orders. Workers can use the sheet or the app and they stay in sync. Postgres/Supabase is not used
in this mode. With `STORE` unset the app behaves exactly as before.

## Sheet layout

| Tab | Columns | Who edits |
|---|---|---|
| `Menu` | Name, Description, Price, Category, Available, Hot, Image URL, Archived | Admins (staff may toggle Available/Hot) |
| `Modifiers` | Item, Group, GroupRequired, Min, Max, Modifier, Price, Available, Description | Admins |
| `Roles` | NetID, Role (`staff`/`admin`), Google Email | Admins |
| `M/D/YYYY` (one per day, Eastern time) | **Name, Order, Done, Paid, Picked Up, Phone Number, Comments** then backend columns **OrderID, NetID, Total, Clover Payment ID, Submitted At, Items JSON, Cancelled** | Workers edit A-G; H-N are admin/backend only |

- A menu item's ID is its **name** (there is no ID column). Renaming an item makes it a new item; old orders
  keep the name and price they were placed with.
- **Images** come from Google Drive. Workers upload a picture to the shared images folder and paste its link
  (any Drive share link) into the `Image URL` column. The server rewrites that to `/api/images/<fileId>`, fetches
  the file with the service account, and caches it for an hour (stale copy served if Drive fails). Non-Drive URLs
  (for example existing Supabase images) are used as-is. Only files the Menu currently references are served, so
  the route cannot be used to read other Drive files. PNG, JPEG, WebP and GIF up to 5 MB.
- Anyone not in `Roles` is a customer.
- Order status comes from the checkboxes: not Paid → `awaiting_payment`; Paid → `pending`; Done → `ready`;
  Picked Up → `completed`; Cancelled → `cancelled`. There is no `preparing` status.
- Rows a worker types by hand are **display-only**: shown in the app, can be marked Done, but have no price and
  cannot be charged. The backend writes `manual:<tab>:<row>` into OrderID so they keep a stable identity.
- `Clover Payment ID` holds the Clover reference for card payments and `BYPASS:<netId>` for an admin bypass.
  Payment attempts themselves are in memory only; the row (Paid + ID) is the durable record.

## How it works

`backend/src/services/sheets/`:

- **mirror.ts** keeps the menu, roles and the last two day tabs in memory, refreshed with one batched read every
  5s and immediately on a webhook ping. All API reads are served from memory. Changes are diffed into the
  existing SSE events (`order:created|updated`, `menu:updated`).
- **store.ts** does every write through one FIFO queue, then re-reads so callers see their own write. Updates find
  the row by OrderID right before writing, so a worker sorting the sheet cannot misdirect a write.
- **client.ts** wraps the Sheets API with retry and backoff on 429/5xx. Quota is 60 reads/min and 60 writes/min
  per service account.
- **model.ts** is the pure layout/parsing/status logic.

Routes: `routes/sheets.ts` (menu, orders, webhook) and `routes/paymentsSheets.ts` (Clover/mock payments). They are
mounted ahead of the Prisma routes when `STORE=sheets`. Menu/modifier write endpoints and image upload return `501`
because the menu is edited in the sheet.

## Setup

1. Share the spreadsheet with `GOOGLE_SHEETS_CLIENT_EMAIL` as **Editor**.
2. Set `STORE=sheets`, `SHEETS_ADMIN_EMAILS` (Google accounts) and `SHEETS_WEBHOOK_SECRET` in `backend/.env`.
3. `cd backend && npm run sheet:setup` creates the tabs, checkbox validation and protected ranges.
4. `npm run sheet:migrate` copies the menu, modifiers and staff/admin roles from Postgres (or type them in).
5. For images: enable the **Google Drive API** on the same Google Cloud project as the service account, create a
   Drive folder for menu images, and share it with `GOOGLE_SHEETS_CLIENT_EMAIL` as **Viewer**. Files do not need
   to be public. `SERVER_BASE_URL` must be this backend's public URL, since it is embedded in the image links.
6. Fill in the **Google Email** column in `Roles`, so the two admin lists match.
7. Paste `backend/apps-script/Code.gs` into the sheet's Apps Script editor, set `WEBHOOK_URL` and
   `WEBHOOK_SECRET` script properties, and run `installTriggers()` once. Without it the app still syncs, on the 5s
   poll.

Protected ranges are per Google account, whereas app roles are per NetID; keep `Roles`, `SHEETS_ADMIN_EMAILS` and
the sheet's protections consistent.

## Limits worth knowing

- A Sheets outage or quota exhaustion stops ordering. The server refuses to start if it cannot read the sheet.
- If the server restarts while a customer is tapping their card, the attempt is lost and the order stays unpaid.
  A payment that succeeds but cannot be written is retried, then logged as `[PAYMENT] CRITICAL` with the Clover ref.
- An image replaced in Drive under the same file can take up to an hour to appear (server cache). A new link shows
  immediately. A file the service account cannot read shows as a broken image and logs a warning.
- Customer order history covers today and yesterday only.
- Unpaid orders appear as rows with Paid unchecked.
- Unknown or unavailable menu items are rejected with 400.
