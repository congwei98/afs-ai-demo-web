import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (name) => readFileSync(new URL(`../app/chat/${name}`, import.meta.url), "utf8");
const tokens = read("apple-liquid-glass.css");

test("supplied Apple CSS stays unchanged, including colors and material values", () => {
  // Fingerprint of the user's reference, ignoring only its final newline.
  assert.equal(createHash("sha256").update(tokens.trimEnd()).digest("hex"), "d3dc9e2805b3b72a13065104e9e1831635fea839b003f6573c6d5e289f3c938a");
});

test("chat styling references Apple tokens without overriding or inventing a palette", () => {
  const mapping = read("chat.css") + read("chat-theme.css");
  const layout = read("chat-layout.css");
  assert.doesNotMatch(mapping + layout, /--(?:apple|lg)-[\w-]+\s*:/);
  assert.doesNotMatch(mapping + layout, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(layout, /rgba?\(/);
  const sourceColors = new Set((tokens.match(/rgba?\([^)]*\)/g) ?? []).map((value) => value.replace(/\s+/g, "").replace(/(?<=[,(])0\./g, ".").replace(/0+\)/g, ")")));
  for (const value of mapping.match(/rgba?\([^)]*\)/g) ?? []) {
    if (value.includes("var(--lg-glass-alpha") || value.includes("var(--chat-alpha)")) continue;
    const normalized = value.replace(/\s+/g, "").replace(/(?<=[,(])0\./g, ".").replace(/0+\)/g, ")");
    assert.ok(sourceColors.has(normalized), `Color must come from the supplied reference: ${value}`);
  }
  for (const token of ["--chat-glass", "--lg-backdrop-blur", "--lg-radius-lg", "--lg-edge-highlight-strong", "--lg-shadow-glass-dark", "--lg-specular-top", "--lg-sheen", "--apple-blue-on-dark", "--apple-font-size-body", "--apple-nav-height"]) {
    assert.ok(mapping.includes(`var(${token})`), `Missing token mapping: ${token}`);
  }
});

test("chat imports source tokens before the component mapping and removes custom wallpaper", () => {
  const page = read("page.tsx");
  assert.ok(page.indexOf('"./apple-liquid-glass.css"') < page.indexOf('"./chat.css"'));
  assert.doesNotMatch(read("ChatWorkbench.tsx"), /useGlassLighting|glass-wallpaper/);
});
