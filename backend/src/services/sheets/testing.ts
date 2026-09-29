// Test-only in-memory stand-in for a spreadsheet. Not imported by production code.
import type { sheets_v4 } from "googleapis";
import type { SheetsApi } from "./api";
import type { Cell } from "./model";

function colToIndex(col: string): number {
  return [...col].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
}

interface ParsedRange {
  title: string;
  c1?: number;
  r1?: number;
  c2?: number;
  r2?: number;
}

function parseRange(range: string): ParsedRange {
  const m = range.match(/^'((?:[^']|'')+)'(?:!([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?)?$/);
  if (!m) throw new Error(`Unable to parse range: ${range}`);
  const title = m[1].replace(/''/g, "'");
  return {
    title,
    c1: m[2] ? colToIndex(m[2]) : undefined,
    r1: m[3] ? Number(m[3]) : undefined,
    c2: m[4] ? colToIndex(m[4]) : m[2] ? colToIndex(m[2]) : undefined,
    r2: m[5] ? Number(m[5]) : m[3] ? Number(m[3]) : undefined,
  };
}

export class FakeSheets implements SheetsApi {
  tabs = new Map<string, { sheetId: number; rows: Cell[][] }>();
  reads = 0;
  metaReads = 0;
  writeCalls = 0;
  requestLog: sheets_v4.Schema$Request[] = [];
  private nextSheetId = 1;
  /** Set to make the next N write calls fail with this error (e.g. a 429). */
  failWrites: { count: number; error: Error } | null = null;

  set(title: string, rows: Cell[][]): void {
    const existing = this.tabs.get(title);
    this.tabs.set(title, { sheetId: existing?.sheetId ?? this.nextSheetId++, rows });
  }

  rows(title: string): Cell[][] {
    return this.tabs.get(title)?.rows ?? [];
  }

  async batchGetValues(ranges: string[]) {
    this.reads++;
    return ranges.map((range) => {
      const p = parseRange(range);
      const tab = this.tabs.get(p.title);
      if (!tab) throw new Error(`Unable to parse range: ${range}`);
      let rows = tab.rows;
      if (p.r1 !== undefined) rows = rows.slice(p.r1 - 1, p.r2);
      if (p.c1 !== undefined) {
        rows = rows.map((row) => {
          const start = p.c1 as number;
          const slice = row.slice(start, (p.c2 ?? start) + 1);
          while (slice.length && (slice[slice.length - 1] === undefined || slice[slice.length - 1] === "")) slice.pop();
          return slice;
        });
      }
      return rows.map((r) => [...r]) as never;
    });
  }

  async getTabs() {
    this.metaReads++;
    return [...this.tabs.entries()].map(([title, t]) => ({ title, sheetId: t.sheetId }));
  }

  private maybeFail(): void {
    this.writeCalls++;
    if (this.failWrites && this.failWrites.count > 0) {
      this.failWrites.count--;
      throw this.failWrites.error;
    }
  }

  async batchUpdate(requests: sheets_v4.Schema$Request[]) {
    this.maybeFail();
    this.requestLog.push(...requests);
    for (const req of requests) {
      if (req.addSheet) {
        const title = req.addSheet.properties!.title!;
        if (this.tabs.has(title)) throw new Error(`A sheet with the name "${title}" already exists`);
        this.tabs.set(title, { sheetId: req.addSheet.properties!.sheetId ?? this.nextSheetId++, rows: [] });
      } else if (req.appendCells) {
        const tab = [...this.tabs.values()].find((t) => t.sheetId === req.appendCells!.sheetId);
        if (!tab) throw new Error("Unknown sheetId");
        for (const rowData of req.appendCells.rows ?? []) {
          tab.rows.push(
            (rowData.values ?? []).map((c) => {
              const v = c.userEnteredValue;
              if (!v) return undefined;
              return v.boolValue ?? v.numberValue ?? v.stringValue ?? undefined;
            }) as Cell[]
          );
        }
      }
    }
  }

  async batchUpdateValues(data: Array<{ range: string; values: Cell[][] }>) {
    this.maybeFail();
    for (const { range, values } of data) {
      const p = parseRange(range);
      const tab = this.tabs.get(p.title);
      if (!tab) throw new Error(`Unable to parse range: ${range}`);
      values.forEach((vals, dr) => {
        const r = (p.r1 ?? 1) - 1 + dr;
        while (tab.rows.length <= r) tab.rows.push([]);
        vals.forEach((v, dc) => {
          tab.rows[r][(p.c1 ?? 0) + dc] = v;
        });
      });
    }
  }
}
