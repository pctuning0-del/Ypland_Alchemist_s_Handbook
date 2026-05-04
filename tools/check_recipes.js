import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../recipes.json", import.meta.url), "utf-8");
const data = JSON.parse(raw);
const recipes = data.recipes;
if (!Array.isArray(recipes)) {
  console.error("Expected recipes array");
  process.exit(1);
}

const keys = new Set();
for (const r of recipes) {
  for (const k of Object.keys(r)) keys.add(k);
}

const ids = recipes.map((r) => r.id);
const seen = new Set();
const dups = [];
for (const id of ids) {
  if (seen.has(id)) dups.push(id);
  seen.add(id);
}

const required = ["id", "name", "profitHint", "time", "ingredients", "story"];
const missing = [];
for (const r of recipes) {
  for (const k of required) {
    if (r[k] === undefined || r[k] === null) missing.push(`${r.id || "?"}: missing ${k}`);
  }
}

let imgOk = 0;
let wikiOk = 0;
for (const r of recipes) {
  const img = String(r.imageUrl || "");
  const wiki = String(r.wikiUrl || "");
  if (/^https?:\/\//u.test(img)) imgOk++;
  if (/^https?:\/\//u.test(wiki)) wikiOk++;
}

console.log("recipes count:", recipes.length);
console.log("fields:", [...keys].sort().join(", "));
console.log("duplicate ids:", dups.length ? dups.join("; ") : "none");
console.log("missing required:", missing.length ? missing.join("\n") : "none");
console.log("with https imageUrl:", imgOk, "/", recipes.length);
console.log("with https wikiUrl:", wikiOk, "/", recipes.length);
