/**
 * Тех-дерево манускрипта: DOM-сетка + Canvas-связи с усиленными визуальными эффектами (анимация, свечение, «поток»).
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

  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  canvas.className = "techTreeConnectors techTreeConnectors--fx";
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

  /** Path2D ортогонального пути со скруглениями — один раз строим, много раз штрихуем. */
  function buildElbowPath2D(sx, sy, midX, ty, tx, radiusCss) {
    const down = ty >= sy;
    const right = tx >= midX;
    const dx1 = Math.abs(midX - sx);
    const dy = Math.abs(ty - sy);
    const dx2 = Math.abs(tx - midX);

    const p = new Path2D();
    p.moveTo(sx, sy);

    if (dx1 < 2 || dy < 2 || dx2 < 2) {
      p.lineTo(midX, sy);
      p.lineTo(midX, ty);
      p.lineTo(tx, ty);
      return p;
    }

    let r = Math.min(radiusCss, dx1 * 0.42, dy * 0.42, dx2 * 0.42);
    r = Math.max(2.5, Math.min(r, dx1 * 0.48, dy * 0.48, dx2 * 0.48));

    p.lineTo(midX - r, sy);
    if (down) p.quadraticCurveTo(midX, sy, midX, sy + r);
    else p.quadraticCurveTo(midX, sy, midX, sy - r);

    if (down) p.lineTo(midX, ty - r);
    else p.lineTo(midX, ty + r);

    if (right) {
      p.quadraticCurveTo(midX, ty, midX + r, ty);
      p.lineTo(tx, ty);
    } else {
      p.quadraticCurveTo(midX, ty, midX - r, ty);
      p.lineTo(tx, ty);
    }
    return p;
  }

  function drawConnectorFx(g, path, coreW, timeMs, edgeIdx, sx, sy, tx, ty, midX) {
    const pulse = 0.85 + 0.15 * Math.sin(timeMs * 0.0018 + edgeIdx * 1.1);
    const flow = prefersReducedMotion ? 0 : timeMs * 0.045;

    g.lineJoin = "round";
    g.lineCap = "round";

    g.shadowColor = "rgba(215, 180, 106, 0.55)";
    g.shadowBlur = 12 * pulse;
    g.shadowOffsetX = 0;
    g.shadowOffsetY = 0;
    g.strokeStyle = `rgba(215, 180, 106, ${0.18 * pulse})`;
    g.lineWidth = coreW * 5.2;
    g.stroke(path);
    g.shadowBlur = 0;

    g.strokeStyle = `rgba(255, 220, 150, ${0.24 * pulse})`;
    g.lineWidth = coreW * 2.8;
    g.stroke(path);

    const ox = Math.sin(timeMs * 0.0005 + edgeIdx) * 14;
    const oy = Math.cos(timeMs * 0.00048 + edgeIdx * 0.7) * 14;
    const grad = g.createLinearGradient(sx + ox, sy + oy, tx - ox, ty - oy);
    grad.addColorStop(0, `rgba(72, 48, 30, ${0.92 + 0.06 * pulse})`);
    grad.addColorStop(0.5, "rgba(38, 24, 15, 0.98)");
    grad.addColorStop(1, "rgba(18, 11, 8, 1)");

    g.strokeStyle = grad;
    g.lineWidth = coreW * 1.05;
    g.stroke(path);

    g.strokeStyle = "rgba(255, 252, 245, 0.5)";
    g.lineWidth = Math.max(0.75, coreW * 0.36);
    g.stroke(path);

    if (!prefersReducedMotion) {
      g.save();
      g.setLineDash([7, 10]);
      g.lineDashOffset = -flow;
      g.strokeStyle = `rgba(255, 214, 120, ${0.55 + 0.2 * Math.sin(timeMs * 0.003 + edgeIdx)})`;
      g.lineWidth = Math.max(1.2, coreW * 0.55);
      g.stroke(path);
      g.setLineDash([]);
      g.restore();
    }

    const dotR = Math.max(2.6, coreW * 0.9) * (0.92 + 0.08 * pulse);
    const ring = dotR * 1.65;
    const midY = (sy + ty) / 2;

    g.fillStyle = `rgba(43, 28, 18, ${0.88 + 0.1 * pulse})`;
    g.beginPath();
    g.arc(sx, sy, dotR, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = `rgba(255, 214, 130, ${0.35 + 0.2 * pulse})`;
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(sx, sy, ring, 0, Math.PI * 2);
    g.stroke();

    g.fillStyle = `rgba(43, 28, 18, ${0.9 + 0.08 * pulse})`;
    g.beginPath();
    g.arc(tx, ty, dotR * 0.95, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = `rgba(255, 214, 130, ${0.3 + 0.18 * pulse})`;
    g.beginPath();
    g.arc(tx, ty, ring * 0.95, 0, Math.PI * 2);
    g.stroke();

    g.fillStyle = "rgba(255, 248, 235, 0.55)";
    g.beginPath();
    g.arc(sx - dotR * 0.2, sy - dotR * 0.2, dotR * 0.32, 0, Math.PI * 2);
    g.fill();

    if (!prefersReducedMotion) {
      const tw = 0.5 + 0.5 * Math.sin(timeMs * 0.004 + edgeIdx * 2.1);
      const rg = g.createRadialGradient(midX, midY, 0, midX, midY, 16);
      rg.addColorStop(0, `rgba(255, 230, 160, ${0.32 * tw})`);
      rg.addColorStop(1, "rgba(255, 230, 160, 0)");
      g.fillStyle = rg;
      g.beginPath();
      g.arc(midX, midY, 16, 0, Math.PI * 2);
      g.fill();
    }
  }

  let lastGeo = { cssW: 0, cssH: 0, dpr: 1, snap: (x) => x, coreW: 3.5, pos: new Map() };

  function measureGeometry() {
    const dpr = pickDpr();
    const snap = (v) => snapCss(v, dpr);
    const cssW = Math.max(1, viewport.scrollWidth);
    const cssH = Math.max(1, viewport.scrollHeight);

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

    lastGeo = { cssW, cssH, dpr, snap, coreW, pos };
  }

  function sizeCanvas() {
    const { cssW, cssH, dpr } = lastGeo;
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    canvas.width = bw;
    canvas.height = bh;
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.style.right = "auto";
    canvas.style.bottom = "auto";
  }

  function paintFrame(timeMs) {
    measureGeometry();
    sizeCanvas();

    const g = canvas.getContext("2d", { alpha: true });
    if (!g) return;

    const { cssW, cssH, dpr, coreW, pos } = lastGeo;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssW, cssH);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";

    let ei = 0;
    for (const e of edges) {
      const a = pos.get(e.fromUid);
      const b = pos.get(e.toUid);
      if (!a || !b) continue;
      let { sx, sy, midX, ty, tx } = elbowGeometry(a, b);
      sx = lastGeo.snap(sx);
      sy = lastGeo.snap(sy);
      midX = lastGeo.snap(midX);
      ty = lastGeo.snap(ty);
      tx = lastGeo.snap(tx);

      const r = Math.min(10, Math.max(4, coreW * 2.2));
      const path = buildElbowPath2D(sx, sy, midX, ty, tx, r);
      drawConnectorFx(g, path, coreW, timeMs, ei, sx, sy, tx, ty, midX);
      ei += 1;
    }
  }

  let rafId = 0;
  const t0 = performance.now();

  function scheduleStaticRedraw() {
    measureGeometry();
    sizeCanvas();
    paintFrame(prefersReducedMotion ? 0 : performance.now() - t0);
  }

  function tick(now) {
    paintFrame(now - t0);
    if (!prefersReducedMotion && !document.hidden) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function startFxLoop() {
    cancelAnimationFrame(rafId);
    if (prefersReducedMotion || document.hidden) {
      scheduleStaticRedraw();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  requestAnimationFrame(() => {
    scheduleStaticRedraw();
    requestAnimationFrame(() => {
      scheduleStaticRedraw();
      startFxLoop();
    });
  });

  const ro = new ResizeObserver(() => {
    scheduleStaticRedraw();
    if (!prefersReducedMotion) startFxLoop();
  });
  ro.observe(viewport);

  const scrollHost = wrap.closest(".manuscriptTreeWrap--tech") || wrap;
  scrollHost.addEventListener("scroll", () => scheduleStaticRedraw(), { passive: true });
  window.addEventListener("resize", scheduleStaticRedraw, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(rafId);
    else startFxLoop();
  });

  return wrap;
}
