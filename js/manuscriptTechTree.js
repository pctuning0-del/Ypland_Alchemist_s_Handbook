/**
 * Тех-дерево манускрипта: колонки по глубине + связи на Canvas (HiDPI, скругления, многослойный stroke).
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

  /** До 3× + чуть выше при отдалении манускрипта (масштаб ниже 100%), чтобы не мылилось. */
  function pickDpr() {
    const base = window.devicePixelRatio || 1;
    const vv = window.visualViewport?.scale;
    const scaleComp = vv && vv > 0 && vv < 1 ? 1 / vv : 1;
    const ms = Math.max(0.5, Math.min(2.35, getManuscriptZoom()));
    const msBoost = ms < 1 ? Math.min(1.28, 1 / Math.pow(ms, 0.28)) : 1;
    return Math.min(3, Math.max(1, base * Math.min(scaleComp, 1.15) * msBoost));
  }

  function snapCss(v, dpr) {
    return Math.round(v * dpr) / dpr;
  }

  /** Чёткие горизонтали/вертикали в CSS-пикселях после масштаба canvas. */
  function snapLineCoord(cssVal, dpr, strokeCss, axis /* 'h' | 'v' */) {
    const dev = cssVal * dpr;
    const sw = strokeCss * dpr;
    const aligned =
      sw % 2 === 1 ? (Math.round(dev - 0.5) + 0.5) / dpr : Math.round(dev) / dpr;
    return aligned;
  }

  function elbowGeometry(a, b) {
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

  /**
   * Ортогональный путь H → V → H со скруглениями на локтях.
   * Предполагается типичный порядок: sx < midX, якоря слева направо.
   */
  function traceRoundedElbow(g, sx, sy, midX, ty, tx, radiusCss) {
    const down = ty >= sy;
    const right = tx >= midX;
    const dx1 = Math.abs(midX - sx);
    const dy = Math.abs(ty - sy);
    const dx2 = Math.abs(tx - midX);

    g.beginPath();
    g.moveTo(sx, sy);

    if (dx1 < 2 || dy < 2 || dx2 < 2) {
      g.lineTo(midX, sy);
      g.lineTo(midX, ty);
      g.lineTo(tx, ty);
      return;
    }

    let r = Math.min(radiusCss, dx1 * 0.42, dy * 0.42, dx2 * 0.42);
    r = Math.max(2.5, Math.min(r, dx1 * 0.48, dy * 0.48, dx2 * 0.48));

    g.lineTo(midX - r, sy);
    if (down) g.quadraticCurveTo(midX, sy, midX, sy + r);
    else g.quadraticCurveTo(midX, sy, midX, sy - r);

    if (down) g.lineTo(midX, ty - r);
    else g.lineTo(midX, ty + r);

    if (right) {
      g.quadraticCurveTo(midX, ty, midX + r, ty);
      g.lineTo(tx, ty);
    } else {
      g.quadraticCurveTo(midX, ty, midX - r, ty);
      g.lineTo(tx, ty);
    }
  }

  function strokeConnectorLayers(g, sx, sy, midX, ty, tx, coreW) {
    const r = Math.min(10, Math.max(4, coreW * 2.2));

    traceRoundedElbow(g, sx, sy, midX, ty, tx, r);

    g.lineJoin = "round";
    g.lineCap = "round";

    const glowW = coreW * 4.2;
    g.lineWidth = glowW;
    g.strokeStyle = "rgba(215, 180, 106, 0.22)";
    g.globalAlpha = 1;
    g.stroke();

    traceRoundedElbow(g, sx, sy, midX, ty, tx, r);
    g.lineWidth = coreW * 2.1;
    g.strokeStyle = "rgba(215, 180, 106, 0.38)";
    g.stroke();

    traceRoundedElbow(g, sx, sy, midX, ty, tx, r);
    const grad = g.createLinearGradient(sx, sy, tx, ty);
    grad.addColorStop(0, "rgba(52, 34, 22, 0.97)");
    grad.addColorStop(0.45, "rgba(38, 25, 16, 0.99)");
    grad.addColorStop(1, "rgba(22, 14, 10, 1)");
    g.lineWidth = coreW;
    g.strokeStyle = grad;
    g.stroke();

    traceRoundedElbow(g, sx, sy, midX, ty, tx, r);
    g.lineWidth = Math.max(0.9, coreW * 0.4);
    g.strokeStyle = "rgba(255, 248, 235, 0.42)";
    g.stroke();

    const dotR = Math.max(2.4, coreW * 0.85);
    g.fillStyle = "rgba(43, 28, 18, 0.95)";
    g.beginPath();
    g.arc(sx, sy, dotR, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(tx, ty, dotR * 0.92, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255, 248, 235, 0.5)";
    g.beginPath();
    g.arc(sx - dotR * 0.25, sy - dotR * 0.25, dotR * 0.35, 0, Math.PI * 2);
    g.fill();
  }

  function redrawLines() {
    const dpr = pickDpr();
    const snap = (v) => snapCss(v, dpr);
    const vpRect = viewport.getBoundingClientRect();
    const cssW = Math.max(1, vpRect.width);
    const cssH = Math.max(1, vpRect.height);
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    canvas.width = bw;
    canvas.height = bh;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const g = canvas.getContext("2d", { alpha: true });
    if (!g) return;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssW, cssH);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";

    const pageScale =
      window.visualViewport && window.visualViewport.scale > 0
        ? Math.min(1.35, window.visualViewport.scale)
        : 1;
    const msZ = Math.max(0.5, Math.min(2.35, getManuscriptZoom()));
    // zoom на #manuscriptZoomScaler уменьшает всё на экране — компенсируем толщину штриха.
    const zoomScreenBoost = msZ < 1 ? 1 / Math.pow(msZ, 0.78) : 1;
    const coreW = Math.min(
      5.6,
      Math.max(
        3.05,
        (3.35 * pageScale * zoomScreenBoost) / Math.pow(msZ, 0.18)
      )
    );

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

    for (const e of edges) {
      const a = pos.get(e.fromUid);
      const b = pos.get(e.toUid);
      if (!a || !b) continue;
      let { sx, sy, midX, ty, tx } = elbowGeometry(a, b);

      sx = snapLineCoord(sx, dpr, coreW, "v");
      sy = snapLineCoord(sy, dpr, coreW, "h");
      midX = snapLineCoord(midX, dpr, coreW, "v");
      ty = snapLineCoord(ty, dpr, coreW, "h");
      tx = snapLineCoord(tx, dpr, coreW, "v");

      strokeConnectorLayers(g, sx, sy, midX, ty, tx, coreW);
    }
  }

  requestAnimationFrame(() => {
    redrawLines();
    requestAnimationFrame(() => redrawLines());
  });
  const ro = new ResizeObserver(() => redrawLines());
  ro.observe(viewport);
  const scrollHost = wrap.closest(".manuscriptTreeWrap--tech") || wrap;
  scrollHost.addEventListener("scroll", () => redrawLines(), { passive: true });
  window.addEventListener("resize", redrawLines, { passive: true });

  return wrap;
}
