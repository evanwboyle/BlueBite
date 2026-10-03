import { useSheets } from "../services/sheets/runtime";

export interface ServerConfig {
  store: "sheets" | "postgres";
  /** Menu items/modifiers/images can be created, edited and deleted through the API. */
  menuEditable: boolean;
  /** Orders have a distinct "preparing" stage between pending and ready. */
  preparingStatus: boolean;
}

/**
 * What this backend supports, so the frontend can hide controls that would only error. With the Google
 * Sheet as the store, the menu is edited in the sheet and the order columns have no "preparing" stage.
 */
export function getServerConfig(): ServerConfig {
  const sheets = useSheets();
  return { store: sheets ? "sheets" : "postgres", menuEditable: !sheets, preparingStatus: !sheets };
}
