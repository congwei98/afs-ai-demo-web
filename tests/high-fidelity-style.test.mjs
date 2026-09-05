import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../app/chat/chat-theme.css", import.meta.url), "utf8");

test("theme backgrounds use colors sampled from both supplied high-fidelity images", () => {
  for (const color of ["rgb(232 241 252)", "rgb(237 242 249)", "rgb(205 208 248)", "rgb(0 1 6)", "rgb(8 12 21)", "rgb(3 4 18)"]) {
    assert.ok(styles.includes(color), `Missing reference color ${color}`);
  }
});

test("high-fidelity type scale keeps primary workbench content legible", () => {
  for (const rule of [
    ".chat-brand { font-size:22px",
    ".chat-message p,.approval-recommendation p,.approval-user-prompt p,.approval-user-reply p,.approval-confirmed p { font-size:18px",
    ".customer-card button strong { font-size:19px",
    ".agent-list strong { font-size:16px",
    ".node-inspector textarea { font-size:17px",
  ]) assert.ok(styles.includes(rule), `Missing type rule: ${rule}`);
});
