import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 4173;
const ROOT = path.resolve(__dirname, "..");

const server = spawn("npx", ["http-server", ROOT, "-p", String(PORT), "-c-1"], { stdio: "inherit" });
await new Promise((r) => setTimeout(r, 1400));

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("h1", { timeout: 7000 });

await browser.close();
server.kill("SIGTERM");

if (errors.length) throw new Error(errors.join("\n"));
