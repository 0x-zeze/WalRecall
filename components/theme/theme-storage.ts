export type Theme = "dark" | "light";

export const OLD_THEME_STORAGE_KEY = "alpharecall-theme";
export const NEW_THEME_STORAGE_KEY = "walrecall-theme";

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

/**
 * Pure migration helper for ThemeProvider.
 * Reads 'walrecall-theme'; if absent, reads 'alpharecall-theme', writes to 'walrecall-theme',
 * and removes 'alpharecall-theme'.
 */
export function migrateThemeKey(storage?: StorageLike | null): Theme | null {
  if (!storage) return null;

  try {
    const modern = storage.getItem(NEW_THEME_STORAGE_KEY);
    if (modern === "light" || modern === "dark") {
      return modern;
    }

    const legacy = storage.getItem(OLD_THEME_STORAGE_KEY);
    if (legacy === "light" || legacy === "dark") {
      try {
        storage.setItem?.(NEW_THEME_STORAGE_KEY, legacy);
        storage.removeItem?.(OLD_THEME_STORAGE_KEY);
      } catch {
        // Ignore write/delete errors in restricted storage contexts
      }
      return legacy;
    }

    return null;
  } catch {
    return null;
  }
}
