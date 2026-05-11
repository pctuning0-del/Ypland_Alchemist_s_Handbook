/**
 * Тех-дерево для манускрипта: колонки по глубине + связи на Canvas (чёткие линии при любом масштабе).
 * @param {object} rootRecipe
 * @param {object} ctx
 * @param {object[]} ctx.recipes
 * @param {() => number} ctx.getManuscriptZoom
 * @param {(r: object) => object[]} ctx.parseIngredientsToItems
 * @param {(all: object[], name: string, id: string) => object | null} ctx.findRecipeForIngredient
 * @param {(name: string, currentId: string) => HTMLElement | null} ctx.makeLogoSpanForIngredient
 * @param {(r: object) => void} ctx.showDetail
 */
export function renderRecipeTechTree(rootRecipe, ctx) {
  const {
    recipes,
    getManuscriptZoom,
    parseIngredientsToItems,
    findRecipeForIngredient,
    makeLogoSpanForIngredient,
    showDetail,
  } = ctx;

  const maxDepth = 6;
  const levels = [];
  const edges = [];

  function ensureDepth(d) {
    while (levels.length <= d) levels.push([]);
  }

  function pushNodeAtDepth(uid, r, d) {
    ensureDepth(d);
    levels[d].push({ uid, recipe: r });
  }

  const queue = [];
  let uidSeq = 0;
  const nextUid = () => {
    uidSeq += 1;
    return `tn-${uidSeq}`;
  };

  if (rootRecipe?.id) {
    const rootUid = nextUid();
    pushNodeAtDepth(rootUid, rootRecipe, 0);
    queue.push({
      r: rootRecipe,
      d: 0,
      uid: rootUid,
      pathIds: new Set([rootRecipe.id]),
    });
  }

  while (queue.length) {
    const { r, d, uid, pathIds } = queue.shift();
    if (d >= maxDepth) continue;
    const groups = parseIngredientsToItems(r);
    for (const g of groups) {
      for (const it of g.items) {
        const linked = findRecipeForIngredient(recipes, it.name, r?.id);
        if (!linked) continue;
        if (pathIds.has(linked.id)) continue;
        const childUid = nextUid();
        edges.push({ fromUid: uid, toUid: childUid });
        pushNodeAtDepth(childUid, linked, d + 1);
        const nextPath = new Set(pathIds);
        nextPath.add(linked.id);
        queue.push({ r: linked, d: d + 1, uid: childUid, pathIds: nextPath });
      }
    }
  }

  const wrap = document.createElement("div");
  wrap.className = "techTreeWrap";

  const viewport = document.createElement("div");
  viewport.className = "techTreeViewport";

  const canvas = document.createElement("canvas");
  canvas.className = "techTreeConnectors";
  canvas.setAttribute("aria-hidden", "true");

  const grid = document.createElement("div");
  grid.className = "techTreeGrid";

  function nodeCard(r, treeUid) {
    const card = document.createElement("div");
    card.className = "techNode";
    card.dataset.treeUid = treeUid;
    card.dataset.recipeId = r.id;

    const head = document.createElement("div");
    head.className = "techNode__head";

    const logo =
      r?.imageUrl && /^https?:\/\//u.test(String(r.imageUrl))
        ? (() => {
            const s = document.createElement("span");
            s.className = "tokenLogo";
            s.style.backgroundImage = `url("${String(r.imageUrl)}")`;
            s.setAttribute("aria-hidden", "true");
            return s;
          })()
        : null;
    if (logo) head.appendChild(logo);

    const title = document.createElement("div");
    title.className = "techNode__title";
    title.textContent = String(r?.name ?? "?");
    head.appendChild(title);
    card.appendChild(head);

    const groupsData = parseIngredientsToItems(r);
    const groupsRoot = document.createElement("div");
    groupsRoot.className = "ingGroups techNode__ingGroups";
    for (const g of groupsData) {
      const group = document.createElement("div");
      group.className = "ingGroup";
      const gh = document.createElement("div");
      gh.className = "ingGroup__head";
      const badge = document.createElement("span");
      badge.className = "ingGroup__badge";
      badge.textContent = g.label;
      gh.appendChild(badge);
      group.appendChild(gh);
      const ingList = document.createElement("div");
      ingList.className = "ingList";
      for (const it of g.items) {
        const line = document.createElement("div");
        line.className = "ingLine";
        const icon = makeLogoSpanForIngredient(it.name, r?.id);
        if (icon) line.appendChild(icon);
        const qty = String(it.qty ?? "").trim();
        const nm = String(it.name ?? "").trim();
        line.appendChild(document.createTextNode(qty ? `${qty} ${nm}` : nm));
        ingList.appendChild(line);
      }
      group.appendChild(ingList);
      groupsRoot.appendChild(group);
    }
    card.appendChild(groupsRoot);

    card.addEventListener("click", () => showDetail(r));
    return card;
  }

  for (let d = 0; d < levels.length; d += 1) {
    const col = document.createElement("div");
    col.className = "techCol";
    col.dataset.depth = String(d);
    for (const { uid, recipe } of levels[d]) {
      col.appendChild(nodeCard(recipe, uid));
    }
    grid.appendChild(col);
  }

  viewport.appendChild(canvas);
  viewport.appendChild(grid);
  wrap.appendChild(viewport);

  function pickDpr() {
    return Math.min(2.5, Math.max(1, window.devicePixelRatio || 1));
  }

  function snapCss(v, dpr) {
    return Math.round(v * dpr) / dpr;
  }

  function elbowPoints(a, b) {
    const sx = a.x2;
    const sy = (a.y1 + a.y2) / 2;
    const tx = b.x1;
    const ty = (b.y1 + b.y2) / 2;
    const span = Math.max(0, tx - sx);
    const minStub = 26;
    let midX = sx + Math.max(minStub, span * 0.56);
    const railMax = tx - Math.max(14, Math.min(32, span * 0.12));
    const railMin = sx + Math.max(minStub, Math.min(40, span * 0.22));
    if (span > 1) midX = Math.min(Math.max(midX, railMin), Math.max(railMin, railMax));
    return { sx, sy, midX, ty, tx };
  }

  function redrawLines() {
    const dpr = pickDpr();
    const snap = (v) => snapCss(v, dpr);
    const vpRect = viewport.getBoundingClientRect();
    const cssW = Math.max(1, vpRect.width);
    const cssH = Math.max(1, vpRect.height);
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    canvas.width = bw;
    canvas.height = bh;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const g = canvas.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssW, cssH);

    const pageScale =
      window.visualViewport && window.visualViewport.scale > 0
        ? Math.min(1.35, window.visualViewport.scale)
        : 1;
    const msZ = Math.max(0.5, Math.min(2.35, getManuscriptZoom()));
    const lineW = Math.min(3.4, Math.max(2, (2.5 * pageScale) / Math.pow(msZ, 0.38)));

    const nodeEls = viewport.querySelectorAll(".techNode[data-tree-uid]");
    const pos = new Map();
    nodeEls.forEach((el) => {
      const uid = el.getAttribute("data-tree-uid");
      if (!uid) return;
      const r = el.getBoundingClientRect();
      pos.set(uid, {
        x1: snap(r.left - vpRect.left),
        y1: snap(r.top - vpRect.top),
        x2: snap(r.right - vpRect.left),
        y2: snap(r.bottom - vpRect.top),
      });
    });

    g.lineJoin = "round";
    g.lineCap = "round";

    for (const e of edges) {
      const a = pos.get(e.fromUid);
      const b = pos.get(e.toUid);
      if (!a || !b) continue;
      const { sx, sy, midX, ty, tx } = elbowPoints(a, b);

      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(midX, sy);
      g.lineTo(midX, ty);
      g.lineTo(tx, ty);

      g.lineWidth = lineW + 2.2;
      g.strokeStyle = "rgba(215, 180, 106, 0.22)";
      g.stroke();

      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(midX, sy);
      g.lineTo(midX, ty);
      g.lineTo(tx, ty);
      g.lineWidth = lineW;
      g.strokeStyle = "rgba(43, 28, 18, 0.82)";
      g.stroke();
    }
  }

  requestAnimationFrame(() => redrawLines());
  const ro = new ResizeObserver(() => redrawLines());
  ro.observe(viewport);
  const scrollHost = wrap.closest(".manuscriptTreeWrap--tech") || wrap;
  scrollHost.addEventListener("scroll", () => redrawLines(), { passive: true });
  window.addEventListener("resize", redrawLines, { passive: true });

  return wrap;
}
