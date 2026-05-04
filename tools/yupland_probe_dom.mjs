import { chromium } from "playwright";

const url = process.argv[2];
if (!url) {
  console.error("Usage: node tools/yupland_probe_dom.mjs <url>");
  process.exit(1);
}

const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
});

try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });

  const summary = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const text = el.innerText ?? "";
      return {
        selector: sel,
        tag: el.tagName.toLowerCase(),
        className: el.className,
        textLen: text.length,
        head: text.replace(/\s+/g, " ").trim().slice(0, 400),
      };
    };

    const candidates = [
      "main",
      "[role='main']",
      "article",
      "[data-testid]",
      ".prose",
      ".markdown",
      ".md",
      "#root main",
      "#root article",
    ];

    const found = candidates.map(pick).filter(Boolean);
    const allDeepMainish = Array.from(
      document.querySelectorAll("main, article, [role='main'], .prose")
    ).map((el, idx) => ({
      idx,
      tag: el.tagName.toLowerCase(),
      className: el.className,
      textLen: (el.innerText ?? "").length,
      head: (el.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 300),
    }));

    return { found, allDeepMainish };
  });

  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}
