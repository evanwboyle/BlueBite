import type { sheets_v4 } from "googleapis";
import * as client from "./client";
import type { CellValue } from "./client";

/** The slice of the Sheets API the store needs. Injected so the mirror and store can be tested with a fake. */
export interface SheetsApi {
  batchGetValues(ranges: string[]): Promise<CellValue[][][]>;
  getTabs(): Promise<Array<{ title: string; sheetId: number }>>;
  batchUpdate(requests: sheets_v4.Schema$Request[]): Promise<void>;
  batchUpdateValues(data: Array<{ range: string; values: CellValue[][] }>): Promise<void>;
}

export const realSheetsApi: SheetsApi = {
  batchGetValues: client.batchGetValues,
  batchUpdate: client.batchUpdate,
  batchUpdateValues: client.batchUpdateValues,
  async getTabs() {
    const sheets = await client.getSpreadsheetMeta();
    return sheets.map((s) => ({
      title: s.properties?.title ?? "",
      sheetId: s.properties?.sheetId ?? 0,
    }));
  },
};
