/**
 * Собирает presentation.html в PDF (Chromium + режим печати).
 * Запуск из корня репозитория: npm run export:presentation-pdf
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "presentation.html");
const outPath = path.join(root, "exports", "presentation.pdf");

const fileUrl = pathToFileURL(htmlPath).href;

fs.mkdirSync(path.dirname(outPath), { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.emulateMedia({ media: "print" });
  await page.goto(fileUrl, { waitUntil: "networkidle", timeout: 60_000 });
  await page.pdf({
    path: outPath,
    format: "A4",
    landscape: true,
    printBackground: true,
    margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    preferCSSPageSize: true,
  });
  console.log("OK:", outPath);
} finally {
  await browser.close();
}
