import { chromium } from "playwright";

const url = process.argv[2];
if (!url) {
  console.error("Usage: node tools/yupland_dump_article.mjs <url>");
  process.exit(1);
}

const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
});

try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });

  const payload = await page.evaluate(() => {
    const article = document.querySelector("article.wiki-book-content");
    if (!article) return { error: "article.wiki-book-content not found" };

    const imgs = Array.from(article.querySelectorAll("img"))
      .map((img) => ({
        src: img.getAttribute("src") || "",
        alt: img.getAttribute("alt") || "",
      }))
      .filter((x) => x.src);

    return {
      htmlLen: article.innerHTML.length,
      text: article.innerText ?? "",
      imgs,
    };
  });

  console.log(JSON.stringify(payload, null, 2));
} finally {
  await browser.close();
}
