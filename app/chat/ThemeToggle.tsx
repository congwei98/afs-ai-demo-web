"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "@phosphor-icons/react";
import { applyTheme, normalizeTheme, THEME_EVENT, THEME_KEY } from "./theme.mjs";

function subscribe(notify: () => void) {
  const syncFromStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY || event.key === null) {
      document.documentElement.dataset.chatTheme = normalizeTheme(event.newValue);
      notify();
    }
  };
  window.addEventListener(THEME_EVENT, notify);
  window.addEventListener("storage", syncFromStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, notify);
    window.removeEventListener("storage", syncFromStorage);
  };
}

const getSnapshot = () => normalizeTheme(document.documentElement.dataset.chatTheme);
const getServerSnapshot = () => "light";

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const dark = theme === "dark";
  return <button type="button" className="theme-toggle" aria-label="深色模式" aria-pressed={dark}
    title={dark ? "切换到浅色模式" : "切换到深色模式"}
    onClick={() => applyTheme(dark ? "light" : "dark")}>
    {dark ? <Moon size={19} aria-hidden="true" /> : <Sun size={19} aria-hidden="true" />}
    <span>{dark ? "深色" : "浅色"}</span>
  </button>;
}
