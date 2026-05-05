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
  const btnSection = document.getElementById("btnSection");
  const sectionSelect = document.getElementById("sectionSelect");
  const recipeCount = document.getElementById("recipeCount");
  const detailEmpty = document.getElementById("detailEmpty");
  const detailContent = document.getElementById("detailContent");
  const detailTitle = document.getElementById("detailTitle");
  const detailMeta = document.getElementById("detailMeta");
  const detailMedia = document.getElementById("detailMedia");
  const detailBody = document.getElementById("detailBody");

  if (
    !listEl ||
    !viewList ||
    !viewDetail ||
    !btnBack ||
    !btnSection ||
    !sectionSelect ||
    !recipeCount ||
    !detailEmpty ||
    !detailContent ||
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

  function clearDetail() {
    detailTitle.textContent = "";
    detailMeta.textContent = "";
    detailMeta.hidden = true;
    detailMedia.hidden = true;
    detailMedia.innerHTML = "";
    detailBody.textContent = "";
    detailContent.hidden = true;
    detailEmpty.hidden = false;
    btnSection.hidden = true;
    btnSection.textContent = "Раздел";
    playEnter(viewDetail);
  }

  function sectionLabel(recipe) {
    const sec = recipe.section ? String(recipe.section).trim() : "";
    return sec || "Без раздела";
  }

  function recipeSubtitle(recipe) {
    const sec = recipe.section ? String(recipe.section).trim() : "";
    if (sec) return sec;
    const ph = recipe.profitHint != null ? String(recipe.profitHint).trim() : "";
    if (ph && ph !== "—") return ph;
    return "";
  }

  function showDetail(recipe) {
    detailEmpty.hidden = true;
    detailContent.hidden = false;

    const sec = sectionLabel(recipe);
    btnSection.textContent = sec;
    btnSection.hidden = !sec;

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

    function renderIngLine(qty, name, currentId) {
      const lineEl = document.createElement("div");
      lineEl.className = "ingLine";

      const qtyStr = String(qty ?? "").trim();
      const nameStr = String(name ?? "").trim();

      function tokenClassForName(n) {
        const key = String(n ?? "").trim();
        const up = key.toUpperCase();
        if (up === "NEAR") return "tokenLogo--near";
        if (up === "BEES") return "tokenLogo--bees";
        if (up === "MED") return "tokenLogo--med";
        if (key === "Golden DarAi") return "tokenLogo--darai";
        return "";
      }

      const tokenClass = tokenClassForName(nameStr);
      if (tokenClass) {
        const logo = document.createElement("span");
        logo.className = `tokenLogo ${tokenClass}`;
        logo.setAttribute("aria-hidden", "true");
        lineEl.appendChild(logo);
        lineEl.appendChild(document.createTextNode(" "));
      }

      if (qtyStr) {
        const qtyEl = document.createElement("strong");
        qtyEl.textContent = qtyStr;
        lineEl.appendChild(qtyEl);
        if (nameStr) lineEl.appendChild(document.createTextNode(" "));
      }

      if (!nameStr) return lineEl;

      const linked = findRecipeForIngredient(recipes, nameStr, currentId);
      if (linked) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ingLink";
        btn.setAttribute("aria-label", `Открыть рецепт: ${linked.name}`);
        btn.textContent = nameStr;
        btn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          showDetail(linked);
        });
        lineEl.appendChild(btn);
      } else {
        lineEl.appendChild(document.createTextNode(nameStr));
      }
      return lineEl;
    }

    function renderFlatIngredients(rawIng) {
      const ingList = document.createElement("div");
      ingList.className = "ingList";
      const s = String(rawIng ?? "").trim();
      if (!s || s === "—") {
        ingList.appendChild(renderIngLine("", "—", recipe.id));
        return ingList;
      }
      const parts = s
        .split(";")
        .map((x) => x.trim())
        .filter(Boolean);
      for (const part of parts) {
        const m = part.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/u);
        if (m) {
          ingList.appendChild(renderIngLine(m[1], m[2], recipe.id));
        } else {
          ingList.appendChild(renderIngLine("", part, recipe.id));
        }
      }
      return ingList;
    }

    function blockLabel(type) {
      if (type === "chooseOne") return "Выбери один";
      if (type === "allRequired") return "Все обязательны";
      return "Состав";
    }

    const blocks = recipe.ingredientsBlocks;
    if (Array.isArray(blocks) && blocks.length) {
      const groups = document.createElement("div");
      groups.className = "ingGroups";

      for (const b of blocks) {
        const group = document.createElement("div");
        group.className = "ingGroup";

        const head = document.createElement("div");
        head.className = "ingGroup__head";
        const badge = document.createElement("span");
        badge.className = "ingGroup__badge";
        badge.textContent = blockLabel(b?.type);
        head.appendChild(badge);
        group.appendChild(head);

        const ingList = document.createElement("div");
        ingList.className = "ingList";
        const items = Array.isArray(b?.items) ? b.items : [];
        for (const it of items) {
          ingList.appendChild(renderIngLine(it?.qty, it?.name, recipe.id));
        }
        group.appendChild(ingList);
        groups.appendChild(group);
      }

      ingBlock.appendChild(groups);
    } else {
      ingBlock.appendChild(renderFlatIngredients(recipe.ingredients));
    }

    detailBody.appendChild(ingBlock);

    if (storyRaw && storyRaw !== "—") {
      const storyEl = document.createElement("p");
      storyEl.className = "detailBlock detailBlock--story";
      storyEl.textContent = storyRaw;
      detailBody.appendChild(storyEl);
    }
    playEnter(viewDetail);
  }

  function playEnter(panel) {
    panel.classList.remove("viewPanel--anim");
    void panel.offsetWidth;
    panel.classList.add("viewPanel--anim");
  }

  function renderRecipeItem(targetUl, recipe) {
    const li = document.createElement("li");
    li.className = "recipeItem";
    const sub = recipeSubtitle(recipe);
    li.innerHTML = `
      <div class="recipeItem__name">${escapeHtml(recipe.name)}</div>
      ${sub ? `<div class="recipeItem__meta">${escapeHtml(sub)}</div>` : ""}
    `;
    li.addEventListener("click", () => showDetail(recipe));
    targetUl.appendChild(li);
  }

  function renderList() {
    const selectedSection = String(sectionSelect.value ?? "");

    const visibleRecipes = selectedSection
      ? recipes.filter((r) => sectionLabel(r) === selectedSection)
      : recipes.slice();

    recipeCount.textContent = selectedSection
      ? `Показано: ${visibleRecipes.length} • Раздел: ${selectedSection}`
      : `Показано: ${visibleRecipes.length} • Все разделы`;

    listEl.innerHTML = "";

    if (!visibleRecipes.length) {
      const li = document.createElement("li");
      li.className = "recipeItem recipeItem--error";
      li.textContent = "В этом разделе пока нет рецептов.";
      listEl.appendChild(li);
      return;
    }

    if (selectedSection) {
      for (const r of visibleRecipes) {
        renderRecipeItem(listEl, r);
      }
      return;
    }

    // Группировка по section, сохраняя порядок появления в recipes.json
    const bySection = new Map();
    for (const r of visibleRecipes) {
      const sec = sectionLabel(r);
      if (!bySection.has(sec)) bySection.set(sec, []);
      bySection.get(sec).push(r);
    }

    for (const [sec, items] of bySection.entries()) {
      const titleLi = document.createElement("li");
      titleLi.className = "recipeSectionTitle";
      titleLi.textContent = sec;
      listEl.appendChild(titleLi);

      const innerUl = document.createElement("ul");
      innerUl.className = "recipeList recipeList--section";
      for (const r of items) {
        renderRecipeItem(innerUl, r);
      }
      const innerWrap = document.createElement("li");
      innerWrap.appendChild(innerUl);
      listEl.appendChild(innerWrap);
    }
  }

  btnBack.addEventListener("click", clearDetail);
  sectionSelect.addEventListener("change", renderList);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") clearDetail();
  });

  // Заполнить выпадающий список разделов (порядок — как в recipes.json)
  const sectionSet = new Set();
  for (const r of recipes) {
    sectionSet.add(sectionLabel(r));
  }
  for (const sec of sectionSet) {
    const opt = document.createElement("option");
    opt.value = sec;
    opt.textContent = sec;
    sectionSelect.appendChild(opt);
  }

  clearDetail();
  renderList();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    init().catch(console.error);
  });
} else {
  init().catch(console.error);
}
