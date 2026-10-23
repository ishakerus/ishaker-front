import { capitalizeName } from "../formatName";

export const ADDON_NAME_MAX_LENGTH = 20;

export const getDefaultAddonName = (productLineName: string) =>
  capitalizeName(productLineName).slice(0, ADDON_NAME_MAX_LENGTH).trimEnd();
