"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  type Theme,
  NEW_THEME_STORAGE_KEY,
  migrateThemeKey,
} from "./theme-storage";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // Sync theme with DOM and localStorage safely with legacy key migration
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = migrateThemeKey(window.localStorage);
        if (saved === "light" || saved === "dark") {
          document.documentElement.classList.toggle("light", saved === "light");
        }
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(NEW_THEME_STORAGE_KEY, next);
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
    document.documentElement.classList.toggle("light", next === "light");
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
export type { Theme };
