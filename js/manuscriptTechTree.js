/**
 * Тех-дерево манускрипта: колонки по глубине + связи через PixiJS/WebGL (Graphics).
 * Карточки остаются в DOM; линии — отдельный слой, те же координаты, что и раньше.
 */

/** Pixi: сначала локальный npm (dev), при отсутствии — CDN (GitHub Pages без node_modules). */
let pixiModulePromise = null;
function loadPixi() {
  if (!pixiModulePromise) {
    pixiModulePromise = import("../node_modules/pixi.js/lib/index.mjs").catch(() =>
      import("https://cdn.jsdelivr.net/npm/pixi.js@8.18.1/dist/pixi.min.mjs")
    );
  }
  return pixiModulePromise;
}

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

  const pixiWrap = document.createElement("div");
  pixiWrap.className = "techTreePixiWrap";
  pixiWrap.setAttribute("aria-hidden", "true");

  const grid = document.createElement("div");
  grid.className = "techTreeGrid";

  /** @type {import('pixi.js').Application | null} */
  let pixiApp = null;
  /** @type {import('pixi.js').Graphics | null} */
  let lineGraphics = null;
  let pixiInitPromise = null;

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

  viewport.appendChild(pixiWrap);
  viewport.appendChild(grid);
  wrap.appendChild(viewport);

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

  function nodeRectContentCoords(el) {
    const er = el.getBoundingClientRect();
    const vr = viewport.getBoundingClientRect();
    const sl = viewport.scrollLeft;
    const st = viewport.scrollTop;
    return {
      x1: er.left - vr.left + sl,
      y1: er.top - vr.top + st,
      x2: er.right - vr.left + sl,
      y2: er.bottom - vr.top + st,
    };
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
   * @param {import('pixi.js').Graphics} gfx
   */
  function appendRoundedElbowPath(gfx, sx, sy, midX, ty, tx, radiusCss) {
    const down = ty >= sy;
    const right = tx >= midX;
    const dx1 = Math.abs(midX - sx);
    const dy = Math.abs(ty - sy);
    const dx2 = Math.abs(tx - midX);

    gfx.moveTo(sx, sy);

    if (dx1 < 2 || dy < 2 || dx2 < 2) {
      gfx.lineTo(midX, sy).lineTo(midX, ty).lineTo(tx, ty);
      return;
    }

    let r = Math.min(radiusCss, dx1 * 0.42, dy * 0.42, dx2 * 0.42);
    r = Math.max(2.5, Math.min(r, dx1 * 0.48, dy * 0.48, dx2 * 0.48));

    gfx.lineTo(midX - r, sy);
    if (down) gfx.quadraticCurveTo(midX, sy, midX, sy + r);
    else gfx.quadraticCurveTo(midX, sy, midX, sy - r);

    if (down) gfx.lineTo(midX, ty - r);
    else gfx.lineTo(midX, ty + r);

    if (right) {
      gfx.quadraticCurveTo(midX, ty, midX + r, ty);
      gfx.lineTo(tx, ty);
    } else {
      gfx.quadraticCurveTo(midX, ty, midX - r, ty);
      gfx.lineTo(tx, ty);
    }
  }

  /**
   * @param {import('pixi.js').Graphics} gfx
   * @param {import('pixi.js').FillGradient | null} grad
   */
  function strokeEdgeLayers(gfx, sx, sy, midX, ty, tx, coreW, grad) {
    const rStroke = Math.min(10, Math.max(4, coreW * 2.2));

    appendRoundedElbowPath(gfx, sx, sy, midX, ty, tx, rStroke);
    gfx.stroke({
      width: coreW * 4.2,
      color: 0xd7b46a,
      alpha: 0.22,
      cap: "round",
      join: "round",
    });

    appendRoundedElbowPath(gfx, sx, sy, midX, ty, tx, rStroke);
    gfx.stroke({
      width: coreW * 2.1,
      color: 0xd7b46a,
      alpha: 0.38,
      cap: "round",
      join: "round",
    });

    appendRoundedElbowPath(gfx, sx, sy, midX, ty, tx, rStroke);
    if (grad) {
      gfx.stroke({
        width: coreW,
        fill: grad,
        cap: "round",
        join: "round",
      });
    } else {
      gfx.stroke({
        width: coreW,
        color: 0x2b1c12,
        alpha: 0.98,
        cap: "round",
        join: "round",
      });
    }

    appendRoundedElbowPath(gfx, sx, sy, midX, ty, tx, rStroke);
    gfx.stroke({
      width: Math.max(0.9, coreW * 0.4),
      color: 0xfff8eb,
      alpha: 0.42,
      cap: "round",
      join: "round",
    });

    const dotR = Math.max(2.4, coreW * 0.85);
    gfx.circle(sx, sy, dotR).fill({ color: 0x2b1c12, alpha: 0.95 });
    gfx.circle(tx, ty, dotR * 0.92).fill({ color: 0x2b1c12, alpha: 0.95 });
    gfx.circle(sx - dotR * 0.25, sy - dotR * 0.25, dotR * 0.35).fill({ color: 0xfff8eb, alpha: 0.5 });
  }

  async function ensurePixi(cssW, cssH, dpr) {
    if (pixiApp && lineGraphics) {
      pixiApp.renderer.resize(cssW, cssH, dpr);
      return;
    }
    if (!pixiInitPromise) {
      pixiInitPromise = (async () => {
        const { Application, Graphics } = await loadPixi();
        const app = new Application();
        await app.init({
          width: cssW,
          height: cssH,
          resolution: dpr,
          autoDensity: true,
          backgroundAlpha: 0,
          antialias: true,
          preference: "webgl",
          autoStart: false,
          powerPreference: "high-performance",
        });
        const g = new Graphics();
        g.roundPixels = true;
        app.stage.addChild(g);

        const view = app.canvas;
        view.classList.add("techTreeConnectors");
        pixiWrap.appendChild(view);

        pixiApp = app;
        lineGraphics = g;
      })();
    }
    await pixiInitPromise;
    if (pixiApp) pixiApp.renderer.resize(cssW, cssH, dpr);
  }

  async function redrawLines() {
    const dpr = pickDpr();
    const snap = (v) => snapCss(v, dpr);
    const cssW = Math.max(1, viewport.scrollWidth);
    const cssH = Math.max(1, viewport.scrollHeight);

    try {
      await ensurePixi(cssW, cssH, dpr);
    } catch (e) {
      console.warn("PixiJS init failed, tech-tree lines hidden:", e);
      return;
    }

    if (!lineGraphics || !pixiApp) return;

    lineGraphics.clear();

    const pageScale =
      window.visualViewport && window.visualViewport.scale > 0
        ? Math.min(1.35, window.visualViewport.scale)
        : 1;
    const msZ = Math.max(0.5, Math.min(2.35, getManuscriptZoom()));
    const zoomScreenBoost = msZ < 1 ? 1 / Math.pow(msZ, 0.78) : 1;
    const coreW = Math.min(
      5.6,
      Math.max(3.05, (3.35 * pageScale * zoomScreenBoost) / Math.pow(msZ, 0.18))
    );

    const { FillGradient } = await loadPixi();

    const nodeEls = viewport.querySelectorAll(".techNode[data-tree-uid]");
    const pos = new Map();
    nodeEls.forEach((el) => {
      const uid = el.getAttribute("data-tree-uid");
      if (!uid) return;
      const r = nodeRectContentCoords(el);
      pos.set(uid, {
        x1: snap(r.x1),
        y1: snap(r.y1),
        x2: snap(r.x2),
        y2: snap(r.y2),
      });
    });

    for (const e of edges) {
      const a = pos.get(e.fromUid);
      const b = pos.get(e.toUid);
      if (!a || !b) continue;
      let { sx, sy, midX, ty, tx } = elbowGeometry(a, b);

      sx = snap(sx);
      sy = snap(sy);
      midX = snap(midX);
      ty = snap(ty);
      tx = snap(tx);

      lineGraphics.beginPath();

      const grad = new FillGradient({
        type: "linear",
        start: { x: sx, y: sy },
        end: { x: tx, y: ty },
        textureSpace: "local",
        colorStops: [
          { offset: 0, color: "#342216" },
          { offset: 0.45, color: "#261910" },
          { offset: 1, color: "#160e0a" },
        ],
      });

      strokeEdgeLayers(lineGraphics, sx, sy, midX, ty, tx, coreW, grad);
    }

    pixiApp.render();
  }

  requestAnimationFrame(() => {
    void redrawLines();
    requestAnimationFrame(() => void redrawLines());
  });
  const ro = new ResizeObserver(() => void redrawLines());
  ro.observe(viewport);
  const scrollHost = wrap.closest(".manuscriptTreeWrap--tech") || wrap;
  scrollHost.addEventListener("scroll", () => void redrawLines(), { passive: true });
  window.addEventListener("resize", () => void redrawLines(), { passive: true });

  return wrap;
}
