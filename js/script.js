// Bem Querer Donuts — site script.

// Digits only, country code first, no "+" or spaces.
//
// Fixed as a source constant — never read from location.search/hash or
// any other visitor-controlled input, so a URL parameter can never
// redirect an order to a different number. This is a static site with no
// build step, so a real .env doesn't apply at runtime in the browser; if
// this project later gains a bundler (Vite/Webpack/etc.), move this to a
// build-time env var then — until that point, a hardcoded constant is the
// correct equivalent.
const WHATSAPP_NUMBER = "5519982312764";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function formatPrice(value) {
  return "R$ " + value.toFixed(2).replace(".", ",");
}

// ---------------------------------------------------------------
// Cart state (persisted to localStorage; falls back to in-memory
// only if storage is unavailable, e.g. private browsing)
// ---------------------------------------------------------------
let cart = [];
try {
  const saved = localStorage.getItem("bem_querer_cart");
  if (saved) cart = JSON.parse(saved);
} catch (err) {
  cart = [];
}

function saveCart() {
  try {
    localStorage.setItem("bem_querer_cart", JSON.stringify(cart));
  } catch (err) {
    /* storage unavailable — cart still works in-memory for this session */
  }
}

const cartFab = document.getElementById("nav-cart-btn");
const cartFabFloating = document.getElementById("cart-fab-floating");
const cartDrawer = document.getElementById("cart-drawer");
const cartOverlay = document.getElementById("cart-overlay");
const cartItemsEl = document.getElementById("cart-items");
const cartTotalEl = document.getElementById("cart-total");
const checkoutBtn = document.getElementById("checkout-btn");

function cartTotalCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

// WARNING: this total is computed entirely client-side from hardcoded
// data-price attributes. It's a mirror for the customer to see before
// sending the message — the merchant must always verify the real total
// in their own system before accepting any payment (PIX, etc.), since
// nothing here is validated or recomputed server-side.
function cartTotalPrice() {
  return cart.reduce((sum, item) => sum + item.qty * item.price, 0);
}

// Cart item names render via textContent-safe DOM construction below —
// never string-concatenate untrusted values into innerHTML. Product
// name/price here come from your own data-* attributes (trusted,
// author-controlled), not user input, but keep it that way: if you ever
// let a customer type a free-text note into the cart, render it with
// .textContent, not string-built innerHTML.
function renderCart() {
  document.querySelectorAll(".cart-count").forEach((el) => {
    el.textContent = cartTotalCount();
  });
  if (cartTotalEl) cartTotalEl.textContent = formatPrice(cartTotalPrice());
  if (checkoutBtn) {
    const isEmpty = cart.length === 0;
    checkoutBtn.classList.toggle("disabled", isEmpty);
    checkoutBtn.href = isEmpty
      ? "#"
      : "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(buildWhatsAppMessage());
  }

  if (!cartItemsEl) return;
  cartItemsEl.innerHTML = "";

  if (cart.length === 0) {
    const empty = document.createElement("p");
    empty.className = "cart-empty";
    empty.textContent = "Seu carrinho está vazio.";
    cartItemsEl.appendChild(empty);
    return;
  }

  cart.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "cart-item";

    const info = document.createElement("div");
    info.className = "cart-item-info";
    const nameEl = document.createElement("div");
    nameEl.className = "cart-item-name";
    nameEl.textContent = item.name;
    info.appendChild(nameEl);
    const priceEl = document.createElement("div");
    priceEl.className = "cart-item-price";
    priceEl.textContent = formatPrice(item.price * item.qty);
    info.appendChild(priceEl);

    const stepper = document.createElement("div");
    stepper.className = "qty-stepper";
    stepper.innerHTML =
      '<button class="qty-btn" data-action="dec" aria-label="Diminuir">-</button>' +
      '<span class="cart-item-qty"></span>' +
      '<button class="qty-btn" data-action="inc" aria-label="Aumentar">+</button>';
    stepper.querySelector(".cart-item-qty").textContent = item.qty;

    const removeBtn = document.createElement("button");
    removeBtn.className = "cart-item-remove";
    removeBtn.setAttribute("aria-label", "Remover");
    removeBtn.innerHTML = "&times;";

    row.appendChild(info);
    row.appendChild(stepper);
    row.appendChild(removeBtn);

    stepper.querySelector('[data-action="dec"]').addEventListener("click", () => {
      item.qty -= 1;
      if (item.qty <= 0) cart.splice(index, 1);
      saveCart();
      renderCart();
    });
    stepper.querySelector('[data-action="inc"]').addEventListener("click", () => {
      item.qty += 1;
      saveCart();
      renderCart();
    });
    removeBtn.addEventListener("click", () => {
      cart.splice(index, 1);
      saveCart();
      renderCart();
    });

    cartItemsEl.appendChild(row);
  });
}

function addToCart(id, name, price) {
  const existing = cart.find((item) => item.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, name, price, qty: 1 });
  }
  saveCart();
  renderCart();

  [cartFab, cartFabFloating].forEach((btn) => {
    if (!btn) return;
    btn.classList.remove("pulse");
    void btn.offsetWidth; // restart animation
    btn.classList.add("pulse");
  });
}

function flashAdded(btn) {
  const original = btn.textContent;
  btn.textContent = "Adicionado!";
  btn.classList.add("added");
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove("added");
  }, 900);
}

function openCartDrawer() {
  cartDrawer.classList.add("open");
  cartOverlay.classList.add("open");
}

function closeCartDrawer() {
  cartDrawer.classList.remove("open");
  cartOverlay.classList.remove("open");
}

cartFab?.addEventListener("click", openCartDrawer);
cartFabFloating?.addEventListener("click", openCartDrawer);
document.getElementById("cart-drawer-close")?.addEventListener("click", closeCartDrawer);
cartOverlay?.addEventListener("click", closeCartDrawer);

// item.name comes only from data-* attributes you wrote in the HTML
// today, not from customer-typed text, so there's no untrusted input
// here yet. If this checkout ever gains free-text fields (customer name,
// address, order notes), sanitize them BEFORE pushing into `lines` here —
// strip/normalize line breaks (\n, \r) so a customer can't forge extra
// lines in the message (e.g. a fake "Total: R$ 0,00" line).
function buildWhatsAppMessage() {
  const lines = ["Olá! Gostaria de fazer o seguinte pedido:", ""];
  cart.forEach((item) => {
    lines.push("• " + item.qty + "x " + item.name + " - " + formatPrice(item.price * item.qty));
  });
  lines.push("", "Total: " + formatPrice(cartTotalPrice()));
  // The whole message is escaped ONCE with encodeURIComponent() where the
  // https://wa.me/ link is built (in renderCart, above) — never escape it
  // line by line here, that would break the text.
  return lines.join("\n");
}

// checkout-btn is a real <a href="https://wa.me/..."> (kept in sync by
// renderCart) so the browser handles the navigation itself — window.open()
// and location.href from JS were getting blocked/blanked on some mobile
// browsers when the page runs inside an iframe (e.g. the Artifact preview).
checkoutBtn.addEventListener("click", (e) => {
  if (cart.length === 0) e.preventDefault();
});

// ---------------------------------------------------------------
// Product cards — tap the card for a quick view, or add straight to
// the cart from its button.
// ---------------------------------------------------------------
document.querySelectorAll(".combo-item").forEach((item) => {
  // "Consulte o valor" items (price not available from the source data)
  // are a real <a href="https://wa.me/..."> link, not a cart entry —
  // skip both cart wiring and quickview so the browser just follows it.
  if (item.classList.contains("combo-item-inquire")) return;

  const addBtn = item.querySelector(".add-to-cart-btn");
  addBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    addToCart(item.dataset.id, item.dataset.name, parseFloat(item.dataset.price));
    flashAdded(addBtn);
  });

  item.addEventListener("click", (e) => {
    if (e.target.closest(".add-to-cart-btn")) return;
    openQuickview(item);
  });
});

// ---------------------------------------------------------------
// Quick-view modal
// ---------------------------------------------------------------
const overlay = document.getElementById("quickview-overlay");
const qvImg = document.getElementById("qv-img");
const qvIcon = document.getElementById("qv-icon");
const qvName = document.getElementById("qv-name");
const qvDesc = document.getElementById("qv-desc");
const qvPrice = document.getElementById("qv-price");
const qvAdd = document.getElementById("qv-add");
const closeBtn = document.getElementById("quickview-close");

let quickviewItem = null;

function openQuickview(el) {
  quickviewItem = el;

  // .textContent, not .innerHTML — dataset.name/desc are author-controlled
  // today, but this is the one spot a future "customer review" or
  // "special instructions" feature would land, so keep it text-safe.
  qvName.textContent = el.dataset.name;
  qvDesc.textContent = el.dataset.desc;
  qvDesc.hidden = !el.dataset.desc;

  const img = el.querySelector(".combo-photo img");
  const iconWrap = el.querySelector(".combo-photo-icon");
  if (img) {
    qvImg.hidden = false;
    qvImg.src = img.src;
    qvImg.alt = img.alt;
    qvIcon.hidden = true;
  } else if (iconWrap) {
    qvImg.hidden = true;
    qvIcon.hidden = false;
    qvIcon.style.background = iconWrap.style.background;
    qvIcon.textContent = iconWrap.querySelector("span")?.textContent || "";
  }
  qvPrice.textContent = formatPrice(parseFloat(el.dataset.price));

  overlay.classList.add("open");
}

function closeQuickview() {
  overlay.classList.remove("open");
}

closeBtn.addEventListener("click", closeQuickview);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeQuickview();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeQuickview();
    closeCartDrawer();
  }
});
qvAdd.addEventListener("click", () => {
  if (!quickviewItem) return;
  addToCart(quickviewItem.dataset.id, quickviewItem.dataset.name, parseFloat(quickviewItem.dataset.price));
  flashAdded(qvAdd);
});

renderCart();

// ---------------------------------------------------------------
// Light page blur while an in-page link scrolls (Ver cardápio, the
// category row, Home/Cardápio in the nav, "Ver todos").
// ---------------------------------------------------------------
const pageWrap = document.getElementById("page-wrap");
let blurTimeout;

function pulseBlur(duration = 240) {
  if (reduceMotion || !pageWrap) return;
  pageWrap.classList.add("is-scrolling");
  clearTimeout(blurTimeout);
  blurTimeout = setTimeout(() => pageWrap.classList.remove("is-scrolling"), duration);
}

document.addEventListener("click", (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  const id = link.getAttribute("href").slice(1);
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  e.preventDefault();
  pulseBlur();
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
});

// ---------------------------------------------------------------
// Light blur on every tap: whatever is pressed (link, button, card)
// softens for a moment. Swiping a carousel fires pointercancel as the
// browser takes over the pan, which releases it straight away.
// ---------------------------------------------------------------
(function () {
  if (reduceMotion) return;
  let pressed = null;

  function release() {
    if (!pressed) return;
    const el = pressed;
    pressed = null;
    setTimeout(() => el.classList.remove("is-pressed"), 80);
  }

  document.addEventListener(
    "pointerdown",
    (e) => {
      const el = e.target.closest("a, button, .combo-item");
      if (!el) return;
      release();
      pressed = el;
      el.classList.add("is-pressed");
    },
    { passive: true }
  );
  ["pointerup", "pointercancel", "dragstart"].forEach((type) =>
    document.addEventListener(type, release, { passive: true })
  );
})();

// ---------------------------------------------------------------
// Category carousels — swipe one by one; arrows on desktop; "Ver
// todos" turns the same track into a grid and back. Everything is
// scoped to its own section so each category works independently.
// ---------------------------------------------------------------
const tracks = Array.from(document.querySelectorAll(".flavors-grid"));

function updateOverflow() {
  tracks.forEach((track) => {
    const section = track.closest(".flavors");
    const fits = !track.classList.contains("expanded") && track.scrollWidth <= track.clientWidth + 4;
    section.classList.toggle("fits", fits);
  });
}

tracks.forEach((track) => {
  const section = track.closest(".flavors");
  const prevBtn = section.querySelector('.carousel-nav [aria-label="Anterior"]');
  const nextBtn = section.querySelector('.carousel-nav [aria-label="Próximo"]');
  const viewAllBtn = section.querySelector(".view-all-btn");

  const step = () => {
    const card = Array.from(track.children).find((c) => c.offsetParent !== null);
    const gap = parseFloat(getComputedStyle(track).columnGap) || 14;
    return card ? card.getBoundingClientRect().width + gap : 220;
  };
  prevBtn?.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
  nextBtn?.addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));

  viewAllBtn?.setAttribute("aria-expanded", "false");
  viewAllBtn?.addEventListener("click", () => {
    pulseBlur(220);
    const expanded = track.classList.toggle("expanded");
    section.classList.toggle("is-expanded", expanded);
    viewAllBtn.textContent = expanded ? "Ver menos" : "Ver todos";
    viewAllBtn.setAttribute("aria-expanded", String(expanded));
    track.scrollLeft = 0;
    if (!expanded) section.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    updateOverflow();
  });
});

updateOverflow();
window.addEventListener("resize", updateOverflow);
window.addEventListener("load", updateOverflow);

// ---------------------------------------------------------------
// Category row: highlight the category currently on screen and keep
// its pill scrolled into view.
// ---------------------------------------------------------------
(function () {
  const navInner = document.querySelector(".category-nav-inner");
  if (!navInner || !("IntersectionObserver" in window)) return;
  const links = Array.from(navInner.querySelectorAll("a"));
  const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
  let current = null;

  function setActive(id) {
    const link = byId.get(id);
    if (!link || link === current) return;
    current = link;
    links.forEach((a) => a.classList.toggle("is-active", a === link));
    const innerRect = navInner.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    navInner.scrollTo({
      left: navInner.scrollLeft + (linkRect.left - innerRect.left) - 24,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => en.isIntersecting && setActive(en.target.id)),
    { rootMargin: "-40% 0px -55% 0px" }
  );
  document.querySelectorAll(".catalog .flavors").forEach((s) => io.observe(s));
})();

// ---------------------------------------------------------------
// Hero: as the page scrolls toward the catalog the photo drifts and
// eases out while the logo/headline/buttons fade into a soft blur.
// Filter/opacity are cleared at the top: either one would cut the
// glass buttons off from the photo behind them.
// ---------------------------------------------------------------
(function () {
  const hero = document.getElementById("top");
  const heroBg = hero?.querySelector(".hero-bg");
  const heroContent = document.getElementById("hero-content");
  if (!hero || !heroBg || !heroContent || reduceMotion) return;

  let ticking = false;
  let lastP = -1;

  function update() {
    ticking = false;
    const h = hero.offsetHeight || 1;
    const p = Math.min(Math.max(window.scrollY / h, 0), 1);
    // Once fully scrolled past the hero (or back at the top), the values
    // stop changing — skip re-writing the same styles on every further
    // scroll frame below the fold, where this work is pure waste.
    if (p === lastP) return;
    lastP = p;
    if (p < 0.005) {
      heroBg.style.transform = "";
      heroContent.style.opacity = "";
      heroContent.style.filter = "";
      heroContent.style.transform = "";
      return;
    }
    heroBg.style.transform = "translate3d(0," + (p * 12).toFixed(2) + "%,0) scale(" + (1 + p * 0.06).toFixed(3) + ")";
    heroContent.style.opacity = String(Math.max(1 - p * 1.35, 0).toFixed(3));
    heroContent.style.filter = "blur(" + (p * 7).toFixed(2) + "px)";
    heroContent.style.transform = "translate3d(0," + (-p * 40).toFixed(1) + "px,0)";
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  update();
})();

// ---------------------------------------------------------------
// Search — filters cards live as the customer types, across name +
// description. Categories with no match are hidden so the results
// stay compact. Purely display toggles on real DOM nodes (no
// innerHTML rebuilding, no eval), so there's no injection surface.
// ---------------------------------------------------------------
(function () {
  const searchInput = document.getElementById("search-input");
  const searchEmpty = document.getElementById("search-empty");
  if (!searchInput) return;

  function normalize(str) {
    return (str || "")
      .toString()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  }

  const items = Array.from(document.querySelectorAll(".combo-item")).map((el) => ({
    el,
    text: normalize(el.dataset.name + " " + el.dataset.desc),
  }));
  const sections = Array.from(document.querySelectorAll(".catalog .flavors"));

  function applyFilter(rawQuery) {
    const query = normalize(rawQuery);
    let visibleCount = 0;

    items.forEach(({ el, text }) => {
      const matches = query === "" || text.includes(query);
      el.style.display = matches ? "" : "none";
      if (matches) visibleCount += 1;
    });

    sections.forEach((section) => {
      const anyVisible = Array.from(section.querySelectorAll(".combo-item")).some((el) => el.style.display !== "none");
      section.hidden = query !== "" && !anyVisible;
    });

    if (searchEmpty) searchEmpty.hidden = !(query !== "" && visibleCount === 0);
    updateOverflow();
  }

  searchInput.addEventListener("input", (e) => applyFilter(e.target.value));

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = sections.find((s) => !s.hidden);
      if (first) {
        pulseBlur();
        first.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      }
      searchInput.blur();
    }
    if (e.key === "Escape") {
      searchInput.value = "";
      applyFilter("");
      searchInput.blur();
    }
  });
})();
