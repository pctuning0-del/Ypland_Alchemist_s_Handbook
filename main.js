function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
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
  const detailBody = document.getElementById("detailBody");

  if (!listEl || !viewList || !viewDetail || !btnBack || !detailTitle || !detailMeta || !detailBody) {
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

  function showDetail(recipe) {
    detailTitle.textContent = recipe.name;
    detailMeta.textContent = `${recipe.profitHint} • ${recipe.time}`;
    detailBody.innerHTML = `
      <p class="detailBlock"><strong>Состав:</strong> ${escapeHtml(recipe.ingredients)}</p>
      <p class="detailBlock detailBlock--story">${escapeHtml(recipe.story)}</p>
    `;
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
      li.innerHTML = `
        <div class="recipeItem__name">${escapeHtml(r.name)}</div>
        <div class="recipeItem__meta">${escapeHtml(r.profitHint)} • ${escapeHtml(r.time)}</div>
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
