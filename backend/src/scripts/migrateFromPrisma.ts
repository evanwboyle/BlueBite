/**
 * One-time copy of the Benjamin Franklin menu, modifiers and staff/admin roles from Postgres into the
 * Menu, Modifiers and Roles tabs. Refuses to touch a tab that already has data unless run with --force.
 * Old orders are not migrated (keep a Postgres dump if you need them).
 *
 *   cd backend && npm run sheet:migrate            (run sheet:setup first)
 */
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { batchGetValues, batchUpdateValues, isSheetsConfigured, type CellValue } from "../services/sheets/client";
import { BUTTERY_NAME, MENU_TAB, MODIFIERS_TAB, ROLES_TAB, quoteTab, safeText } from "../services/sheets/model";

dotenv.config();

const force = process.argv.includes("--force");

async function tabIsEmpty(tab: string): Promise<boolean> {
  const [rows] = await batchGetValues([`${quoteTab(tab)}!A2:A`]);
  return rows.length === 0;
}

async function main() {
  if (!isSheetsConfigured()) throw new Error("Google Sheets credentials are not configured.");
  const prisma = new PrismaClient();

  try {
    const items = await prisma.menuItem.findMany({
      where: { archived: false, buttery: BUTTERY_NAME },
      include: {
        modifiers: { where: { archived: false } },
        modifierGroups: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    const staff = await prisma.user.findMany({ where: { role: { in: ["staff", "admin"] } }, orderBy: { netId: "asc" } });

    // Item IDs are names in Sheets mode, so duplicate names would collide.
    const seen = new Map<string, number>();
    const menuRows: CellValue[][] = [];
    const modifierRows: CellValue[][] = [];
    for (const item of items) {
      const count = (seen.get(item.name) ?? 0) + 1;
      seen.set(item.name, count);
      const name = count === 1 ? item.name : `${item.name} (${count})`;
      if (count > 1) console.warn(`! duplicate item name "${item.name}" renamed to "${name}"`);

      menuRows.push([
        safeText(name),
        safeText(item.description ?? ""),
        item.price,
        safeText(item.category),
        item.available,
        item.hot,
        safeText(item.image ?? ""),
        false,
      ]);

      const groups = new Map(item.modifierGroups.map((g) => [g.id, g]));
      for (const mod of item.modifiers) {
        const group = mod.modifierGroupId ? groups.get(mod.modifierGroupId) : undefined;
        modifierRows.push([
          safeText(name),
          safeText(group?.name ?? ""),
          group?.required ?? false,
          group?.minSelections ?? 0,
          group?.maxSelections ?? "",
          safeText(mod.name),
          mod.price,
          true,
          safeText(mod.description ?? ""),
        ]);
      }
    }
    const roleRows: CellValue[][] = staff.map((u) => [u.netId, u.role, ""]);

    const plan: Array<[string, CellValue[][]]> = [
      [MENU_TAB, menuRows],
      [MODIFIERS_TAB, modifierRows],
      [ROLES_TAB, roleRows],
    ];
    for (const [tab] of plan) {
      if (!force && !(await tabIsEmpty(tab))) {
        throw new Error(`"${tab}" already has data. Re-run with --force to overwrite from row 2.`);
      }
    }
    for (const [tab, rows] of plan) {
      if (rows.length) await batchUpdateValues([{ range: `${quoteTab(tab)}!A2`, values: rows }]);
      console.log(`+ ${tab}: ${rows.length} rows`);
    }
    console.log("\nRoles: fill in the Google Email column for each admin, then set SHEETS_ADMIN_EMAILS to match.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
