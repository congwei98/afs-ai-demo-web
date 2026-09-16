import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

async function waitForServer(url, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Next.js did not start within 20 seconds");
}

test("production server renders the process workbench", async (context) => {
  const port = 3317;
  const nextBin = new URL("../node_modules/next/dist/bin/next", import.meta.url);
  const projectRoot = new URL("..", import.meta.url);
  const server = spawn(process.execPath, [fileURLToPath(nextBin), "start", "-p", String(port)], {
    cwd: fileURLToPath(projectRoot),
    stdio: "ignore",
  });
  context.after(() => server.kill());

  const response = await waitForServer(`http://127.0.0.1:${port}/`);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /AFS AI Workbench/);
  assert.match(html, /Task Management/);
  assert.match(html, /High-risk complaint investigation/);
  assert.match(html, /Complaint Leading Agent/);

  const chatResponse = await fetch(`http://127.0.0.1:${port}/chat`);
  assert.equal(chatResponse.status, 200);
  const chatHtml = await chatResponse.text();
  assert.match(chatHtml, /AFS AI Workbench/);
  assert.match(chatHtml, /Task Center/);
  assert.match(chatHtml, /Complaint investigation progress/);
  assert.match(chatHtml, /Risk &amp; Request Classification/);
  assert.match(chatHtml, /Complaint Investigation/);
  assert.match(chatHtml, /Resolution Review/);
  assert.match(chatHtml, /Complaint Leading Agent/);
  assert.match(chatHtml, /High-risk complaint investigation/);
  assert.match(chatHtml, /Process Management/);
  assert.match(chatHtml, /Access Management/);
  assert.match(chatHtml, /New Task/);
  assert.match(chatHtml, /Show All Tasks/);
  assert.match(chatHtml, /Do anything/);
  assert.match(chatHtml, /A high-risk complaint has been identified/);
  assert.doesNotMatch(chatHtml, /A6 DATA APPROVAL/);
});
