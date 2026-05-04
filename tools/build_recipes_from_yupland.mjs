import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));

function usage() {
  console.error(
    "Usage:\n" +
      "  node tools/build_recipes_from_yupland.mjs tools/yupland_import_manifest.json\n" +
      "Env:\n" +
      "  OUT=recipes.json (default: ../recipes.json relative to tools/)"
  );
}

function slugifyId(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function extractSlugFromWikiUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    // /wiki/p/<space>/<pageSlug...>
    const idx = parts.indexOf("p");
    if (idx !== -1 && parts[idx + 2]) {
      return parts.slice(idx + 2).join("/");
    }
  } catch {
    // ignore
  }
  return "";
}

function parseRecipeText(text, meta) {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const title = meta.displayName || lines[0] || "Рецепт";

  let sectionLine = "";
  let resultLine = "";
  let upgradeLine = "";

  const ingredientsLines = [];

  let mode = "scan"; // scan | ingredients | footer

  for (const line of lines.slice(1)) {
    if (line.startsWith("Раздел алхимии:")) {
      sectionLine = line.replace(/^Раздел алхимии:\s*/u, "").trim();
      continue;
    }
    if (/^Результат:/u.test(line)) {
      resultLine = line.replace(/^Результат:\s*/u, "").trim();
      continue;
    }
    if (/^Улучшени/u.test(line)) {
      upgradeLine = line.trim();
      continue;
    }
    if (line === "Ингредиенты") {
      mode = "ingredients";
      continue;
    }
    if (line.startsWith("Крафт в Sendler") || /^Источник:/u.test(line)) {
      mode = "footer";
      continue;
    }

    if (mode === "ingredients") ingredientsLines.push(line);
  }

  const ingredients = ingredientsLines.join("; ");

  const profitParts = [];
  // Раздел уже хранится отдельно в recipes.section — не дублируем его в profitHint.
  if (upgradeLine) profitParts.push(upgradeLine);
  else if (resultLine) profitParts.push(`Результат: ${resultLine}`);

  const profitHint = profitParts.join(" • ");

  // Длинный «рассказ» со страницы вики не сохраняем — только состав/метаданные в JSON.
  const story = "";

  return {
    title,
    profitHint,
    ingredients,
    story,
    sectionLine,
    resultLine,
    upgradeLine,
  };
}

async function extractArticle(page, url) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });

  return await page.evaluate(() => {
    const article = document.querySelector("article.wiki-book-content");
    if (!article) return { error: "article.wiki-book-content not found" };

    const text = article.innerText ?? "";
    const imgs = Array.from(article.querySelectorAll("img"))
      .map((img) => img.getAttribute("src") || "")
      .filter((src) => /^https?:\/\//u.test(src));

    return { text, imageUrl: imgs[0] ?? "" };
  });
}

async function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    usage();
    process.exit(1);
  }

  const manifestRaw = readFileSync(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestRaw);
  if (!Array.isArray(manifest)) throw new Error("Manifest must be an array");

  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });

  try {
    const page = await browser.newPage();

    const recipes = [];
    const usedIds = new Set();

    for (const item of manifest) {
      const section = String(item.section ?? "").trim();
      const url = String(item.url ?? "").trim();
      const displayName = String(item.displayName ?? "").trim();
      if (!url) throw new Error("Manifest item missing url");

      const extracted = await extractArticle(page, url);
      if (extracted.error) {
        throw new Error(`${extracted.error} (${url})`);
      }

      const parsed = parseRecipeText(extracted.text, { displayName });

      const slugFromUrl = extractSlugFromWikiUrl(url);
      const slugish = slugFromUrl
        ? slugifyId(slugFromUrl.replace(/\//g, "-"))
        : "";

      let id = slugifyId(slugish || displayName || parsed.title);
      if (!id) id = slugifyId(parsed.title);
      let uniqueId = id;
      let n = 2;
      while (usedIds.has(uniqueId)) {
        uniqueId = `${id}-${n}`;
        n += 1;
      }
      usedIds.add(uniqueId);

      recipes.push({
        id: uniqueId,
        section,
        name: parsed.title,
        profitHint: parsed.profitHint || "",
        time: "",
        ingredients: parsed.ingredients || "—",
        story: parsed.story || "",
        wikiUrl: url,
        imageUrl: extracted.imageUrl || "",
      });
    }

    const out = { recipes };

    const outPath =
      process.env.OUT && process.env.OUT.trim()
        ? process.env.OUT.trim()
        : join(__dirname, "..", "recipes.json");

    writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf-8");
    console.log(`Wrote ${recipes.length} recipes -> ${outPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
