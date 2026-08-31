export const THEME_KEY = "afs-workbench-theme";
export const THEME_EVENT = "afs-theme-change";

export function normalizeTheme(value) {
  return value === "dark" ? "dark" : "light";
}

// Run before the workbench is painted; unavailable storage falls back to light.
export const themeBootstrap = `(()=>{let theme="light";try{theme=localStorage.getItem(${JSON.stringify(THEME_KEY)})==="dark"?"dark":"light"}catch{}document.documentElement.dataset.chatTheme=theme})()`;

export function applyTheme(theme, browserWindow = window) {
  const next = normalizeTheme(theme);
  browserWindow.document.documentElement.dataset.chatTheme = next;
  try { browserWindow.localStorage.setItem(THEME_KEY, next); } catch { /* Session-only when storage is blocked. */ }
  browserWindow.dispatchEvent(new browserWindow.Event(THEME_EVENT));
}
