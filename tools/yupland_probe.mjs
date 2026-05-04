import { chromium } from "playwright";

const url = process.argv[2];
if (!url) {
  console.error("Usage: node tools/yupland_probe.mjs <url>");
  process.exit(1);
}

const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
});

try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
  const title = await page.title();
  const text = await page.evaluate(() => document.body?.innerText ?? "");
  console.log("TITLE:", title);
  console.log("TEXT_LEN:", text.length);
  console.log("TEXT_HEAD:\n" + text.slice(0, 2000));
} finally {
  await browser.close();
}
