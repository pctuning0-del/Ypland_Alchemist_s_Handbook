import { renderRecipeTechTree } from "./js/manuscriptTechTree.js";

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
  const manuscriptOverlay = document.getElementById("manuscriptOverlay");
  const manuscriptSectionTitle = document.getElementById("manuscriptSectionTitle");
  const manuscriptBody = document.getElementById("manuscriptBody");
  const manuscriptZoomViewport = document.getElementById("manuscriptZoomViewport");
  const manuscriptZoomScaler = document.getElementById("manuscriptZoomScaler");
  const manuscriptZoomContent = document.getElementById("manuscriptZoomContent");
  const btnMsZoomOut = document.getElementById("btnMsZoomOut");
  const btnMsZoomIn = document.getElementById("btnMsZoomIn");
  const btnMsZoomReset = document.getElementById("btnMsZoomReset");
  const manuscriptZoomLabel = document.getElementById("manuscriptZoomLabel");
  const btnManuscriptClose = document.getElementById("btnManuscriptClose");
  const manuscriptSheet = manuscriptOverlay?.querySelector?.(".manuscriptSheet") ?? null;

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
    !detailBody ||
    !manuscriptOverlay ||
    !manuscriptSectionTitle ||
    !manuscriptBody ||
    !manuscriptZoomViewport ||
    !manuscriptZoomScaler ||
    !manuscriptZoomContent ||
    !btnMsZoomOut ||
    !btnMsZoomIn ||
    !btnMsZoomReset ||
    !manuscriptZoomLabel ||
    !btnManuscriptClose
  ) {
    console.error("Не хватает элементов разметки для списка/деталей.");
    return;
  }

  // На всякий случай: hidden у оверлея должен реально скрывать его (CSS тоже помогает).
  manuscriptOverlay.hidden = true;

  // Масштаб вкладки (Ctrl+/−) меняет visualViewport — перерисуем линии тех-дерева без дублирующихся слушателей на каждое дерево.
  if (window.visualViewport) {
    let vvRaf = 0;
    const bumpLayoutFromVisualViewport = () => {
      if (vvRaf) return;
      vvRaf = requestAnimationFrame(() => {
        vvRaf = 0;
        window.dispatchEvent(new Event("resize"));
      });
    };
    window.visualViewport.addEventListener("resize", bumpLayoutFromVisualViewport, { passive: true });
    window.visualViewport.addEventListener("scroll", bumpLayoutFromVisualViewport, { passive: true });
  }

  /** Масштаб только содержимого манускрипта (не всей страницы). */
  let manuscriptZoom = 1;
  const MS_Z_MIN = 0.5;
  const MS_Z_MAX = 2.25;
  const MS_Z_STEP = 0.1;

  function applyManuscriptZoom(next) {
    manuscriptZoom = Math.min(MS_Z_MAX, Math.max(MS_Z_MIN, next));
    const z = manuscriptZoom;
    manuscriptZoomScaler.style.zoom = "";
    manuscriptZoomScaler.style.transform = "";
    if (typeof CSS !== "undefined" && CSS.supports && CSS.supports("zoom", "1")) {
      manuscriptZoomScaler.style.zoom = String(z);
    } else {
      manuscriptZoomScaler.style.transform = `scale(${z})`;
    }
    manuscriptZoomLabel.textContent = `${Math.round(z * 100)}%`;
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
        requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
      });
    });
  }

  btnMsZoomOut.addEventListener("click", () => {
    applyManuscriptZoom(manuscriptZoom - MS_Z_STEP);
  });
  btnMsZoomIn.addEventListener("click", () => {
    applyManuscriptZoom(manuscriptZoom + MS_Z_STEP);
  });
  btnMsZoomReset.addEventListener("click", () => {
    applyManuscriptZoom(1);
  });

  manuscriptZoomViewport.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -MS_Z_STEP : MS_Z_STEP;
      applyManuscriptZoom(manuscriptZoom + delta);
    },
    { passive: false }
  );

  let manuscriptViewportScrollRaf = 0;
  manuscriptZoomViewport.addEventListener(
    "scroll",
    () => {
      if (manuscriptViewportScrollRaf) return;
      manuscriptViewportScrollRaf = requestAnimationFrame(() => {
        manuscriptViewportScrollRaf = 0;
        window.dispatchEvent(new Event("resize"));
      });
    },
    { passive: true }
  );

  applyManuscriptZoom(1);

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
    const bits = [];
    const sec = recipe.section ? String(recipe.section).trim() : "";
    const boost = recipe.boost ? String(recipe.boost).trim() : "";
    const ph = recipe.profitHint != null ? String(recipe.profitHint).trim() : "";
    const tm = recipe.time != null ? String(recipe.time).trim() : "";
    const repTo = recipe.repTo != null ? String(recipe.repTo).trim() : "";
    const pl = recipe.pl != null ? String(recipe.pl).trim() : "";

    if (sec) bits.push(sec);
    if (repTo) bits.push(pl ? `Репутация: ${repTo} (${pl} PL)` : `Репутация: ${repTo}`);
    if (boost && boost !== "—") bits.push(`Boost ${boost}`);
    if (ph && ph !== "—") bits.push(ph);
    if (tm && tm !== "—" && tm !== "-") bits.push(tm);
    return bits.join(" • ");
  }

  let currentRecipe = null;

  function showDetail(recipe) {
    currentRecipe = recipe;
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
        if (up === "HOPE") return "tokenLogo--hope";
        if (key === "Magic Dust") return "tokenLogo--magic-dust";
        if (key === "Golden DarAi") return "tokenLogo--darai";
        return "";
      }

      const linked = nameStr
        ? findRecipeForIngredient(recipes, nameStr, currentId)
        : null;

      // Значок в начале строки:
      // 1) если ингредиент — другой рецепт и у него есть картинка, показываем её;
      // 2) иначе показываем токен-иконку для NEAR/BEES/MED/Golden DarAi.
      const linkedImg = linked?.imageUrl ? String(linked.imageUrl).trim() : "";
      const tokenClass = tokenClassForName(nameStr);
      const iconUrlOk = /^https?:\/\//u.test(linkedImg);
      if (iconUrlOk || tokenClass) {
        const logo = document.createElement("span");
        logo.className = iconUrlOk ? "tokenLogo" : `tokenLogo ${tokenClass}`;
        if (iconUrlOk) {
          logo.style.backgroundImage = `url("${linkedImg}")`;
        }
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

  function playEnterManuscript() {
    manuscriptOverlay.classList.remove("manuscriptOverlay--open");
    if (manuscriptSheet) manuscriptSheet.classList.remove("manuscriptSheet--enter");
    void manuscriptOverlay.offsetWidth;
    manuscriptOverlay.classList.add("manuscriptOverlay--open");
    if (manuscriptSheet) manuscriptSheet.classList.add("manuscriptSheet--enter");
  }

  function parseIngredientsToItems(r) {
    // Возвращает массив групп: { label, items: [{qty, name}] }
    const blocks = r?.ingredientsBlocks;
    if (Array.isArray(blocks) && blocks.length) {
      const label = (t) => {
        if (t === "chooseOne") return "ВЫБЕРИ ОДИН";
        if (t === "allRequired") return "ВСЕ ОБЯЗАТЕЛЬНЫ";
        return "СОСТАВ";
      };
      return blocks.map((b) => ({
        label: label(String(b?.type ?? "")),
        items: (Array.isArray(b?.items) ? b.items : []).map((it) => ({
          qty: String(it?.qty ?? "").trim(),
          name: String(it?.name ?? "").trim(),
        })),
      }));
    }

    const s = String(r?.ingredients ?? "").trim();
    if (!s || s === "—") return [{ label: "СОСТАВ", items: [{ qty: "", name: "—" }] }];
    const parts = s
      .split(";")
      .map((x) => x.trim())
      .filter(Boolean);
    const items = parts.map((part) => {
      const m = part.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/u);
      if (m) return { qty: m[1], name: m[2].trim() };
      return { qty: "", name: part };
    });
    return [{ label: "СОСТАВ", items }];
  }

  function makeLogoSpanForIngredient(name, currentId) {
    const nameStr = String(name ?? "").trim();
    if (!nameStr) return null;

    // 1) картинка рецепта, если есть
    const linked = findRecipeForIngredient(recipes, nameStr, currentId);
    const linkedImg = linked?.imageUrl ? String(linked.imageUrl).trim() : "";
    if (/^https?:\/\//u.test(linkedImg)) {
      const logo = document.createElement("span");
      logo.className = "tokenLogo";
      logo.style.backgroundImage = `url("${linkedImg}")`;
      logo.setAttribute("aria-hidden", "true");
      return logo;
    }

    // 2) токен-иконки
    const up = nameStr.toUpperCase();
    let tokenClass = "";
    if (up === "NEAR") tokenClass = "tokenLogo--near";
    else if (up === "BEES") tokenClass = "tokenLogo--bees";
    else if (up === "MED") tokenClass = "tokenLogo--med";
    else if (up === "HOPE") tokenClass = "tokenLogo--hope";
    else if (nameStr === "Golden DarAi") tokenClass = "tokenLogo--darai";
    if (!tokenClass) return null;

    const logo = document.createElement("span");
    logo.className = `tokenLogo ${tokenClass}`;
    logo.setAttribute("aria-hidden", "true");
    return logo;
  }

  function renderRecipeTree(rootRecipe) {
    // Горизонтальное дерево: узел -> дети (если ингредиент — другой рецепт, раскрываем)
    const maxDepth = 6;

    function nodeForRecipe(r, depth, visitedIds) {
      const row = document.createElement("div");
      row.className = "treeRow";

      const node = document.createElement("div");
      node.className = "treeNode";

      const title = document.createElement("div");
      title.className = "treeNode__title";

      const logo = r?.imageUrl && /^https?:\/\//u.test(String(r.imageUrl))
        ? (() => {
            const s = document.createElement("span");
            s.className = "tokenLogo";
            s.style.backgroundImage = `url("${String(r.imageUrl)}")`;
            s.setAttribute("aria-hidden", "true");
            return s;
          })()
        : null;
      if (logo) title.appendChild(logo);

      const titleText = document.createElement("span");
      titleText.textContent = String(r?.name ?? "?");
      title.appendChild(titleText);
      node.appendChild(title);

      const list = document.createElement("div");
      list.className = "treeNode__list";

      const groups = parseIngredientsToItems(r);
      for (const g of groups) {
        // маленький разделитель-лейбл
        const lab = document.createElement("div");
        lab.style.opacity = "0.75";
        lab.style.fontWeight = "800";
        lab.style.fontSize = "12px";
        lab.style.letterSpacing = "0.3px";
        lab.textContent = g.label;
        list.appendChild(lab);

        for (const it of g.items) {
          const line = document.createElement("div");
          line.className = "treeNode__line";
          const icon = makeLogoSpanForIngredient(it.name, r?.id);
          if (icon) line.appendChild(icon);
          const txt = document.createElement("span");
          const qty = String(it.qty ?? "").trim();
          const nm = String(it.name ?? "").trim();
          txt.textContent = qty ? `${qty} ${nm}` : nm;
          line.appendChild(txt);
          list.appendChild(line);
        }
      }

      node.appendChild(list);
      row.appendChild(node);

      if (depth >= maxDepth) return row;

      // дети = ингредиенты, которые являются рецептами
      const children = [];
      for (const g of groups) {
        for (const it of g.items) {
          const linked = findRecipeForIngredient(recipes, it.name, r?.id);
          if (!linked) continue;
          if (visitedIds.has(linked.id)) continue;
          children.push(linked);
        }
      }

      if (!children.length) return row;

      const next = document.createElement("div");
      next.className = "treeChildren";
      for (const ch of children) {
        const nextVisited = new Set(visitedIds);
        nextVisited.add(ch.id);
        next.appendChild(nodeForRecipe(ch, depth + 1, nextVisited));
      }
      row.appendChild(next);
      return row;
    }

    const visited = new Set();
    if (rootRecipe?.id) visited.add(rootRecipe.id);
    return nodeForRecipe(rootRecipe, 0, visited);
  }

  function openManuscriptForSection(sectionName) {
    const sec = String(sectionName ?? "").trim();
    if (!sec) return;

    manuscriptSectionTitle.textContent = sec;
    manuscriptZoomContent.replaceChildren();
    applyManuscriptZoom(1);

    const sectionRecipes = recipes.filter((r) => sectionLabel(r) === sec);

    const intro = document.createElement("div");
    intro.style.margin = "0 0 14px";
    intro.style.opacity = "0.85";
    intro.textContent = `Рецептов в разделе: ${sectionRecipes.length}`;
    manuscriptZoomContent.appendChild(intro);

    if (!sectionRecipes.length) {
      const p = document.createElement("p");
      p.textContent = "В этом разделе пока нет рецептов.";
      manuscriptZoomContent.appendChild(p);
    } else {
      for (const r of sectionRecipes) {
        const wrap = document.createElement("div");
        wrap.className = "manuscriptRecipe";

        const head = document.createElement("div");
        head.className = "manuscriptRecipe__head";
        const nm = document.createElement("div");
        nm.className = "manuscriptRecipe__name";
        nm.textContent = r.name;
        const meta = document.createElement("div");
        meta.className = "manuscriptRecipe__meta";
        const repTo = r.repTo != null ? String(r.repTo).trim() : "";
        const pl = r.pl != null ? String(r.pl).trim() : "";
        meta.textContent = repTo
          ? (pl ? `Репутация: ${repTo} (${pl} PL)` : `Репутация: ${repTo}`)
          : (r.boost
              ? `Boost ${String(r.boost)}`
              : (r.profitHint ? String(r.profitHint) : ""));
        head.appendChild(nm);
        head.appendChild(meta);
        wrap.appendChild(head);

        const tree = document.createElement("div");
        tree.className = "manuscriptTreeWrap manuscriptTreeWrap--tech";
        tree.appendChild(
          renderRecipeTechTree(r, {
            recipes,
            getManuscriptZoom: () => manuscriptZoom,
            parseIngredientsToItems,
            findRecipeForIngredient,
            makeLogoSpanForIngredient,
            showDetail,
          })
        );
        wrap.appendChild(tree);

        manuscriptZoomContent.appendChild(wrap);
      }
    }

    manuscriptOverlay.hidden = false;
    requestAnimationFrame(() => playEnterManuscript());
  }

  function closeManuscript() {
    manuscriptOverlay.classList.remove("manuscriptOverlay--open");
    if (manuscriptSheet) manuscriptSheet.classList.remove("manuscriptSheet--enter");
    manuscriptOverlay.hidden = true;
    manuscriptZoomContent.replaceChildren();
    applyManuscriptZoom(1);
  }

  function renderRecipeItem(targetUl, recipe) {
    const li = document.createElement("li");
    li.className = "recipeItem";
    const repTo = recipe.repTo != null ? String(recipe.repTo).trim() : "";
    const pl = recipe.pl != null ? String(recipe.pl).trim() : "";
    const boost = recipe.boost ? String(recipe.boost).trim() : "";
    const repLine = repTo ? (pl ? `Репутация: ${repTo} (${pl} PL)` : `Репутация: ${repTo}`) : "";
    const sub = repLine || (boost ? `Boost ${boost}` : recipeSubtitle(recipe));
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
  btnSection.addEventListener("click", () => {
    const sec = currentRecipe ? sectionLabel(currentRecipe) : "";
    openManuscriptForSection(sec);
  });
  btnManuscriptClose.addEventListener("click", closeManuscript);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!manuscriptOverlay.hidden) closeManuscript();
      else clearDetail();
    }
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
