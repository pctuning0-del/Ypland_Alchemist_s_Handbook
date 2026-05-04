function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function normalizeRecipeName(s) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Если строка совпадает с именем другого рецепта в книге — вернуть его. */
function findRecipeForIngredient(allRecipes, componentName, currentId) {
  const key = normalizeRecipeName(componentName);
  if (!key) return null;
  for (const r of allRecipes) {
    if (r.id === currentId) continue;
    if (normalizeRecipeName(r.name) === key) return r;
  }
  return null;
}

async function loadRecipes() {
  const res = await fetch("recipes.json", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`recipes.json: ${res.status}`);
  }
  const data = await res.json();
  if (!data.recipes || !Array.isArray(data.recipes)) {
    throw new Error("В recipes.json нет массива recipes");
  }
  return data.recipes;
}

async function init() {
  const listEl = document.getElementById("recipeList");
  const viewList = document.getElementById("viewList");
  const viewDetail = document.getElementById("viewDetail");
  const btnBack = document.getElementById("btnBack");
  const detailTitle = document.getElementById("detailTitle");
  const detailMeta = document.getElementById("detailMeta");
  const detailMedia = document.getElementById("detailMedia");
  const detailBody = document.getElementById("detailBody");

  if (
    !listEl ||
    !viewList ||
    !viewDetail ||
    !btnBack ||
    !detailTitle ||
    !detailMeta ||
    !detailMedia ||
    !detailBody
  ) {
    console.error("Не хватает элементов разметки для списка/деталей.");
    return;
  }

  let recipes = [];

  try {
    recipes = await loadRecipes();
  } catch (e) {
    console.error(e);
    listEl.innerHTML =
      `<li class="recipeItem recipeItem--error">
        Не удалось загрузить <strong>recipes.json</strong>.
        Открой сайт через локальный сервер: <code>py -m http.server 8000</code>, затем <code>http://127.0.0.1:8000</code>
      </li>`;
    return;
  }

  function showList() {
    viewDetail.hidden = true;
    viewDetail.classList.add("viewPanel--hidden");
    viewList.hidden = false;
    viewList.classList.remove("viewPanel--hidden");
    playEnter(viewList);
  }

  function recipeSubtitle(recipe) {
    const sec = recipe.section ? String(recipe.section).trim() : "";
    if (sec) return sec;
    const ph = recipe.profitHint != null ? String(recipe.profitHint).trim() : "";
    if (ph && ph !== "—") return ph;
    return "";
  }

  function showDetail(recipe) {
    detailTitle.textContent = recipe.name;

    const sub = recipeSubtitle(recipe);
    detailMeta.textContent = sub;
    detailMeta.hidden = !sub;

    const imgUrl = recipe.imageUrl ? String(recipe.imageUrl) : "";
    const wikiUrl = recipe.wikiUrl ? String(recipe.wikiUrl) : "";

    if (imgUrl && /^https?:\/\//u.test(imgUrl)) {
      detailMedia.hidden = false;
      detailMedia.innerHTML = `
        <img class="detailImg" src="${escapeHtml(imgUrl)}" alt="${escapeHtml(recipe.name)}" loading="lazy" decoding="async" />
        ${
          wikiUrl && /^https?:\/\//u.test(wikiUrl)
            ? `<div class="detailWiki"><a class="detailWikiLink" href="${escapeHtml(
                wikiUrl
              )}" target="_blank" rel="noopener noreferrer">Открыть страницу в вики YupLand</a></div>`
            : ""
        }
      `;
    } else {
      detailMedia.hidden = true;
      detailMedia.innerHTML = "";
    }

    const storyRaw = String(recipe.story ?? "").trim();

    detailBody.textContent = "";
    const ingBlock = document.createElement("div");
    ingBlock.className = "detailBlock detailBlock--ingredients";

    const ingLabel = document.createElement("div");
    ingLabel.className = "ingredientsLabel";
    ingLabel.innerHTML = "<strong>Состав:</strong>";
    ingBlock.appendChild(ingLabel);

    const ingList = document.createElement("div");
    ingList.className = "ingList";

    const rawIng = String(recipe.ingredients ?? "").trim();
    if (!rawIng || rawIng === "—") {
      const lineEl = document.createElement("div");
      lineEl.className = "ingLine";
      lineEl.textContent = "—";
      ingList.appendChild(lineEl);
    } else {
      const parts = rawIng
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const part of parts) {
        const lineEl = document.createElement("div");
        lineEl.className = "ingLine";
        const m = part.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/u);
        if (m) {
          const qtyEl = document.createElement("strong");
          qtyEl.textContent = m[1];
          lineEl.appendChild(qtyEl);
          lineEl.appendChild(document.createTextNode(" "));
          const rest = m[2].trim();
          const linked = findRecipeForIngredient(recipes, rest, recipe.id);
          if (linked) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "ingLink";
            btn.setAttribute("aria-label", `Открыть рецепт: ${linked.name}`);
            btn.textContent = rest;
            btn.addEventListener("click", (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              showDetail(linked);
            });
            lineEl.appendChild(btn);
          } else {
            lineEl.appendChild(document.createTextNode(rest));
          }
        } else {
          lineEl.textContent = part;
        }
        ingList.appendChild(lineEl);
      }
    }

    ingBlock.appendChild(ingList);
    detailBody.appendChild(ingBlock);

    if (storyRaw && storyRaw !== "—") {
      const storyEl = document.createElement("p");
      storyEl.className = "detailBlock detailBlock--story";
      storyEl.textContent = storyRaw;
      detailBody.appendChild(storyEl);
    }

    viewList.hidden = true;
    viewList.classList.add("viewPanel--hidden");
    viewDetail.hidden = false;
    viewDetail.classList.remove("viewPanel--hidden");
    playEnter(viewDetail);
  }

  function playEnter(panel) {
    panel.classList.remove("viewPanel--anim");
    void panel.offsetWidth;
    panel.classList.add("viewPanel--anim");
  }

  function renderList() {
    listEl.innerHTML = "";
    for (const r of recipes) {
      const li = document.createElement("li");
      li.className = "recipeItem";
      const sub = recipeSubtitle(r);
      li.innerHTML = `
        <div class="recipeItem__name">${escapeHtml(r.name)}</div>
        ${
          sub
            ? `<div class="recipeItem__meta">${escapeHtml(sub)}</div>`
            : ""
        }
      `;
      li.addEventListener("click", () => showDetail(r));
      listEl.appendChild(li);
    }
  }

  btnBack.addEventListener("click", showList);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !viewDetail.hidden) {
      showList();
    }
  });

  renderList();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    init().catch(console.error);
  });
} else {
  init().catch(console.error);
}
