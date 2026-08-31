import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { applyTheme, normalizeTheme, THEME_KEY, THEME_EVENT, themeBootstrap } from "../app/chat/theme.mjs";

function environment(stored, blocked = false) {
  const values = new Map([[THEME_KEY, stored]]);
  const events = [];
  return {
    document: { documentElement: { dataset: {} } },
    localStorage: {
      getItem(key) { if (blocked) throw Error("Storage blocked"); return values.get(key); },
      setItem(key, value) { if (blocked) throw Error("Storage blocked"); values.set(key, value); },
    },
    Event,
    dispatchEvent(event) { events.push(event.type); },
    events,
  };
}

test("theme boots before paint with saved preference, defaulting to light", () => {
  for (const [stored, expected] of [[null, "light"], ["light", "light"], ["dark", "dark"], ["invalid", "light"]]) {
    const env = environment(stored);
    vm.runInNewContext(themeBootstrap, env);
    assert.equal(env.document.documentElement.dataset.chatTheme, expected);
    assert.equal(normalizeTheme(stored), expected);
  }
});

test("theme can toggle both ways and persists without touching workflow state", () => {
  const env = environment(null);
  for (const theme of ["dark", "light", "dark"]) {
    applyTheme(theme, env);
    assert.equal(env.document.documentElement.dataset.chatTheme, theme);
    assert.equal(env.localStorage.getItem(THEME_KEY), theme);
    assert.equal(env.events.at(-1), THEME_EVENT);
    vm.runInNewContext(themeBootstrap, env);
    assert.equal(env.document.documentElement.dataset.chatTheme, theme);
  }
});

test("unavailable storage never prevents switching themes", () => {
  const env = environment(null, true);
  vm.runInNewContext(themeBootstrap, env);
  assert.equal(env.document.documentElement.dataset.chatTheme, "light");
  applyTheme("dark", env);
  assert.equal(env.document.documentElement.dataset.chatTheme, "dark");
});

test("light and dark use distinct semantic surfaces and preserve white primary-button labels", () => {
  const read = (name) => readFileSync(new URL(`../app/chat/${name}`, import.meta.url), "utf8");
  const themes = read("chat-theme.css");
  assert.match(themes, /--chat-text:var\(--apple-ink\)/);
  assert.match(themes, /--chat-accent:var\(--apple-blue\)/);
  assert.match(themes, /--chat-canvas:var\(--apple-bg-parchment\)/);
  assert.match(themes, /:root\[data-chat-theme="dark"\] .chat-app/);
  assert.match(themes, /--chat-text:var\(--apple-text-primary\)/);
  assert.match(themes, /--chat-canvas:var\(--apple-bg-black\)/);
  assert.match(read("chat.css"), /border-radius:var\(--lg-radius-pill\); color:var\(--apple-text-primary\)/);
  assert.match(read("ThemeToggle.tsx"), /aria-pressed=\{dark\}/);
});
