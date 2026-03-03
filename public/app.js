const API_BASE_URL = "";

let state = {
  products: [],
  selectedProductId: null,
  syncing: false,
};

const productsContainer = document.getElementById("products-container");
const selectionInfo = document.getElementById("selection-info");
const syncButton = document.getElementById("sync-button");
const syncAllButton = document.getElementById("sync-all-button");
const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");
const reviewsContainer = document.getElementById("reviews-container");

function setStatus(text, { loading = false } = {}) {
  statusEl.textContent = text || "";
  statusEl.classList.toggle("loading", loading);
}

function renderProducts() {
  productsContainer.innerHTML = "";
  if (!state.products.length) {
    productsContainer.innerHTML = '<div class="empty-state">No hay productos para mostrar.</div>';
    return;
  }
  state.products.forEach((p) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "product-card" + (state.selectedProductId === p.product_id ? " selected" : "");
    card.addEventListener("click", () => {
      state.selectedProductId = p.product_id;
      renderProducts();
      onProductSelected(p);
    });

    const main = document.createElement("div");
    main.className = "product-main";

    const title = document.createElement("div");
    title.className = "product-title";
    title.textContent = `${p.brand} ${p.model}`;

    const meta = document.createElement("div");
    meta.className = "product-meta";
    meta.textContent = p.description;

    const dealer = document.createElement("div");
    dealer.className = "product-dealer";
    dealer.textContent = p.dealer_name || p.dealer_id;

    main.appendChild(title);
    main.appendChild(meta);
    main.appendChild(dealer);

    card.appendChild(main);

    productsContainer.appendChild(card);
  });
}

function renderReviews(productId, result) {
  const { summary, allReviews, newIds } = result;

  // Refrescar también el encabezado con marca y modelo
  const product = state.products.find((p) => p.product_id === productId);
  if (product) {
    selectionInfo.textContent = `Producto seleccionado: ${product.brand} ${product.model} (${product.product_id})`;
  }
  summaryEl.textContent = summary
    ? `Total asociadas: ${summary.totalMatched} (nuevas: ${summary.newMatched}, previas: ${summary.previouslyMatched})`
    : "";

  reviewsContainer.innerHTML = "";
  if (!allReviews || !allReviews.length) {
    reviewsContainer.innerHTML = '<div class="empty-state">Aún no hay reviews asociadas a este producto.</div>';
    return;
  }

  allReviews.forEach((r) => {
    const card = document.createElement("div");
    const isNew = newIds && newIds.has(r.review_id);
    card.className = "review-card" + (isNew ? " review-card-new" : "");

    const header = document.createElement("div");
    header.className = "review-header";

    const source = document.createElement("div");
    source.className = "review-source";
    source.textContent = r.external_dealer_name;

    const rating = document.createElement("div");
    rating.className = "review-rating";
    if (typeof r.rating === "number") {
      rating.textContent = "★".repeat(Math.round(r.rating)) || `${r.rating.toFixed(1)}★`;
    } else {
      rating.textContent = "";
    }

    header.appendChild(source);
    header.appendChild(rating);

    const text = document.createElement("div");
    text.className = "review-text";
    text.textContent = r.text;

    const meta = document.createElement("div");
    meta.className = "review-meta";
    const parts = [`ID: ${r.review_id}`];
    if (typeof r.confidence === "number") {
      parts.push(`confianza LLM: ${(r.confidence * 100).toFixed(0)}%`);
    }
    if (isNew) {
      parts.push("nueva de esta sincronización");
    }
    meta.textContent = parts.join(" · ");

    card.appendChild(header);
    card.appendChild(text);
    card.appendChild(meta);
    reviewsContainer.appendChild(card);
  });
}

function onProductSelected(product) {
  selectionInfo.textContent = `Producto seleccionado: ${product.brand} ${product.model} (${product.product_id})`;
  syncButton.disabled = false;
  summaryEl.textContent = "";
  reviewsContainer.innerHTML = "";
  fetchProductReviews(product.product_id);
}

async function fetchProducts() {
  try {
    const res = await fetch(`${API_BASE_URL}/products`);
    const data = await res.json();
    state.products = data;
    renderProducts();
    setStatus("");
  } catch (err) {
    console.error(err);
    productsContainer.innerHTML =
      '<div class="empty-state">Error cargando productos. Revisa que la API esté levantada.</div>';
  }
}

async function fetchProductReviews(productId) {
  try {
    setStatus("Cargando reviews guardadas...", { loading: true });
    const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productId)}/reviews`);
    const data = await res.json();
    renderReviews(productId, { allReviews: data.reviews ?? [], summary: null });
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("Error cargando reviews.", { loading: false });
  }
}

async function syncReviews() {
  if (!state.selectedProductId || state.syncing) return;
  state.syncing = true;
  syncButton.disabled = true;
  syncAllButton.disabled = true;
  setStatus("Sincronizando con el LLM...", { loading: true });
  summaryEl.textContent = "";
  reviewsContainer.innerHTML = "";

  try {
    const res = await fetch(
      `${API_BASE_URL}/products/${encodeURIComponent(state.selectedProductId)}/reviews/sync`,
      {
        method: "POST",
      },
    );
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error || `Error HTTP ${res.status}`);
    }
    const data = await res.json();
    const newIds = new Set((data.newReviews ?? []).map((r) => r.review_id));
    renderReviews(state.selectedProductId, {
      allReviews: data.allReviews ?? [],
      summary: data.summary ?? null,
      newIds,
    });
    setStatus("Listo.");
  } catch (err) {
    console.error(err);
    setStatus("Error al sincronizar reviews. Revisa el backend.", { loading: false });
  } finally {
    state.syncing = false;
    syncButton.disabled = !state.selectedProductId;
    syncAllButton.disabled = false;
    statusEl.classList.remove("loading");
  }
}

async function syncAllReviews() {
  if (state.syncing) return;
  state.syncing = true;
  syncButton.disabled = true;
  syncAllButton.disabled = true;
  summaryEl.textContent = "";
  reviewsContainer.innerHTML = "";
  setStatus("Sincronizando todos los productos con el LLM...", { loading: true });

  const startedAt = performance.now();

  try {
    const res = await fetch(`${API_BASE_URL}/products/reviews/sync-all`, {
      method: "POST",
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error || `Error HTTP ${res.status}`);
    }
    const data = await res.json();
    const elapsed = typeof data.durationMs === "number" ? data.durationMs : performance.now() - startedAt;
    const summaries = data.summaries || [];

    const totalMatched = summaries.reduce((acc, s) => acc + (s.totalMatched || 0), 0);
    const totalNew = summaries.reduce((acc, s) => acc + (s.newMatched || 0), 0);

    summaryEl.textContent = `Sync masiva: ${data.processedProducts}/${data.totalProducts} productos en ${Math.round(
      elapsed,
    )} ms. Reviews totales: ${totalMatched}, nuevas: ${totalNew}.`;

    if (data.errors && data.errors.length) {
      console.warn("Errores en sync masiva", data.errors);
    }

    setStatus("Sync masiva completada.");
  } catch (err) {
    console.error(err);
    setStatus("Error en sync masiva de reviews. Revisa el backend.", { loading: false });
  } finally {
    state.syncing = false;
    syncButton.disabled = !state.selectedProductId;
    syncAllButton.disabled = false;
    statusEl.classList.remove("loading");
  }
}

syncButton.addEventListener("click", () => {
  syncReviews();
});

syncAllButton.addEventListener("click", () => {
  syncAllReviews();
});

fetchProducts();

