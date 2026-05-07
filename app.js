// ── Config ──────────────────────────────────────────────────
const API_BASE = "https://eco-cart-frontend.onrender.com/api";
let sessionScore = 0;
let chatHistory = [];
const counters = { bottles: 0, bags: 0, cups: 0, towels: 0 };

// ── Tab Navigation ────────────────────────────────────────────
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    switchTab(btn.dataset.tab);
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

function switchTab(tab) {
  document.querySelectorAll("[id^='tab-']").forEach((el) => el.classList.add("hidden"));
  const section = document.getElementById(`tab-${tab}`);
  if (section) section.classList.remove("hidden");

  // Products section lives outside tab wrapper
  const productsSection = document.getElementById("products-section");
  if (tab === "shop") {
    productsSection.classList.remove("hidden");
    section.classList.remove("hidden");
  } else {
    productsSection.classList.add("hidden");
  }
}

function scrollToProducts() {
  document.getElementById("products-section").scrollIntoView({ behavior: "smooth" });
}

// ── Products ──────────────────────────────────────────────────
let allProducts = [];

async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    const data = await res.json();
    allProducts = data.products || [];
    renderProducts(allProducts);
  } catch (err) {
    document.getElementById("productsGrid").innerHTML =
      `<p style="color:#888; grid-column: 1/-1; text-align:center; padding:2rem;">⚠️ Could not load products. Make sure the backend server is running.</p>`;
  }
}

function renderProducts(products) {
  const grid = document.getElementById("productsGrid");
  if (!products.length) {
    grid.innerHTML = `<p style="color:#888; grid-column: 1/-1; text-align:center; padding:2rem;">No products match your filters.</p>`;
    return;
  }

  grid.innerHTML = products.map((p) => `
    <div class="product-card" onclick="viewProduct('${p.id}')">
      <span class="product-emoji">${p.image || "🌿"}</span>
      <div class="product-name">${p.name}</div>
      <div class="product-brand">${p.brand}</div>
      <div class="product-desc">${p.description}</div>
      <div class="eco-score-row">
        <div class="eco-score">
          🌱 ${p.ecoScore}/10
        </div>
        <div class="product-price">$${p.price.toFixed(2)}</div>
      </div>
      <div class="score-bar" style="margin: 0.6rem 0;">
        <div class="score-fill" style="width: ${p.ecoScore * 10}%"></div>
      </div>
      <div class="tags-row">
        ${(p.tags || []).slice(0, 3).map((t) => `<span class="tag">${t}</span>`).join("")}
      </div>
    </div>
  `).join("");
}

function filterProducts() {
  const category = document.getElementById("categoryFilter").value;
  const minScore = parseInt(document.getElementById("ecoFilter").value) || 0;
  const search = document.getElementById("searchInput").value.toLowerCase();

  let filtered = allProducts;
  if (category) filtered = filtered.filter((p) => p.category === category);
  if (minScore) filtered = filtered.filter((p) => p.ecoScore >= minScore);
  if (search) filtered = filtered.filter((p) =>
    p.name.toLowerCase().includes(search) ||
    p.brand.toLowerCase().includes(search) ||
    p.description.toLowerCase().includes(search)
  );

  renderProducts(filtered);
}

function viewProduct(id) {
  const p = allProducts.find((x) => x.id === id);
  if (!p) return;
  switchTab("analyze");
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  document.querySelector('[data-tab="analyze"]').classList.add("active");
  document.getElementById("productName").value = p.name;
  document.getElementById("productBrand").value = p.brand;
  document.getElementById("productCategory").value = p.category;
  document.getElementById("productDesc").value = p.description;
  document.getElementById("productName").focus();
}

// ── AI Product Analyzer ───────────────────────────────────────
async function analyzeProduct() {
  const name = document.getElementById("productName").value.trim();
  const brand = document.getElementById("productBrand").value.trim();
  const category = document.getElementById("productCategory").value;
  const description = document.getElementById("productDesc").value.trim();

  if (!name) {
    alert("Please enter a product name.");
    return;
  }

  const btn = document.getElementById("analyzeBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Analyzing…`;

  const resultEl = document.getElementById("analyzeResult");
  resultEl.classList.add("hidden");

  try {
    const res = await fetch(`${API_BASE}/analysis/product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, brand, category, description }),
    });

    if (!res.ok) throw new Error("Analysis failed");
    const data = await res.json();

    renderAnalysis(data, name);
    addScore(data.ecoScore);
  } catch (err) {
    resultEl.classList.remove("hidden");
    resultEl.innerHTML = `<p style="color:#e53935; padding: 1rem;">⚠️ Failed to analyze product. Please ensure the backend is running and your API key is set.</p>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>🔍 Analyze Eco Impact</span>`;
  }
}

function renderAnalysis(data, productName) {
  const resultEl = document.getElementById("analyzeResult");
  resultEl.classList.remove("hidden");

  const gradeEmoji = { "A+": "🌟", A: "✅", B: "👍", C: "🟡", D: "⚠️", F: "🚫" };
  const factorColors = (v) => {
    if (v >= 8) return "#4a8c5c";
    if (v >= 6) return "#8bc34a";
    if (v >= 4) return "#ffc107";
    return "#f44336";
  };

  const factors = data.factors || {};
  const factorNames = {
    carbonFootprint: "Carbon Footprint",
    recyclability: "Recyclability",
    materials: "Materials",
    packaging: "Packaging",
    durability: "Durability",
    ethicalProduction: "Ethical Production",
  };

  resultEl.innerHTML = `
    <div style="text-align:center;">
      <div class="result-score-circle" style="border-color:${data.gradeColor}; color:${data.gradeColor}; background: ${data.gradeColor}10;">
        <span>${data.ecoScore || "?"}</span>
        <span style="font-size:0.9rem; font-family:'DM Sans';">/10</span>
      </div>
      <div style="font-size:1.3rem; margin-bottom:0.25rem;">${gradeEmoji[data.grade] || ""} Grade: <strong>${data.grade || "?"}</strong></div>
      <div style="font-size:0.85rem; color:var(--text-soft); margin-bottom:1.5rem;">${productName}</div>
      <p style="font-size:0.9rem; color:var(--text-mid); line-height:1.6; margin-bottom:1.5rem;">${data.summary || ""}</p>
    </div>

    <div class="result-factors">
      ${Object.entries(factorNames).map(([key, label]) => {
        const val = factors[key] || 0;
        return `
          <div class="factor-row">
            <span class="factor-label">${label}</span>
            <div class="factor-bar">
              <div class="factor-fill" style="width:${val * 10}%; background:${factorColors(val)};"></div>
            </div>
            <span class="factor-num">${val}</span>
          </div>
        `;
      }).join("")}
    </div>

    <div class="result-lists">
      <div class="result-list">
        <h4>✅ Positives</h4>
        <ul>${(data.positives || []).map((p) => `<li><span>•</span>${p}</li>`).join("") || "<li>None noted</li>"}</ul>
      </div>
      <div class="result-list">
        <h4>⚠️ Concerns</h4>
        <ul>${(data.concerns || []).map((c) => `<li><span>•</span>${c}</li>`).join("") || "<li>None noted</li>"}</ul>
      </div>
    </div>

    ${data.alternatives?.length ? `
      <div style="margin: 1.25rem 0;">
        <h4 style="font-size:0.85rem; color:var(--text-mid); margin-bottom:0.5rem;">🌱 Greener Alternatives</h4>
        ${data.alternatives.map((a) => `
          <div style="padding:0.6rem 0; border-bottom:1px solid var(--border); font-size:0.85rem;">
            <strong>${a.name}</strong> — ${a.reason}
          </div>
        `).join("")}
      </div>
    ` : ""}

    ${data.certifications?.length ? `
      <div style="display:flex; flex-wrap:wrap; gap:0.4rem; margin-bottom:1rem;">
        ${data.certifications.map((c) => `<span class="tag">🏷️ ${c}</span>`).join("")}
      </div>
    ` : ""}

    ${data.tip ? `<div class="result-tip">💡 <strong>Tip:</strong> ${data.tip}</div>` : ""}
  `;
}

// ── Chat ───────────────────────────────────────────────────────
async function sendChat() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;

  input.value = "";
  appendMessage("user", msg);
  chatHistory.push({ role: "user", content: msg });

  const typingEl = appendMessage("bot", "Thinking…", true);

  try {
    const res = await fetch(`${API_BASE}/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatHistory.slice(-8), userMessage: msg }),
    });

    typingEl.remove();

    if (!res.ok) throw new Error("Chat failed");
    const data = await res.json();

    appendMessage("bot", data.reply);
    chatHistory.push({ role: "assistant", content: data.reply });
    addScore(2);
  } catch (err) {
    typingEl.remove();
    appendMessage("bot", "⚠️ Sorry, I couldn't connect to the server. Please make sure the backend is running.");
  }
}

function appendMessage(role, text, isTyping = false) {
  const container = document.getElementById("chatMessages");
  const el = document.createElement("div");
  el.className = `message ${role}${isTyping ? " typing" : ""}`;

  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  el.innerHTML = `
    <div class="message-bubble">${text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</div>
    <span class="message-time">${now}</span>
  `;

  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return el;
}

function sendSuggestion(btn) {
  document.getElementById("chatInput").value = btn.textContent;
  sendChat();
}

// ── Impact Calculator ──────────────────────────────────────────
function adjust(key, delta) {
  counters[key] = Math.max(0, (counters[key] || 0) + delta);
  document.getElementById(`${key}-val`).textContent = counters[key];
}

async function calculateImpact() {
  const params = new URLSearchParams({
    plasticBottles: counters.bottles,
    plasticBags: counters.bags,
    disposableCups: counters.cups,
    paperTowels: counters.towels,
  });

  const total = Object.values(counters).reduce((a, b) => a + b, 0);
  if (total === 0) {
    alert("Please adjust at least one counter above zero.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/analysis/impact-calculator?${params}`);
    const data = await res.json();

    const resultEl = document.getElementById("impactResult");
    resultEl.classList.remove("hidden");
    resultEl.innerHTML = `
      <h3>🌍 Your Monthly Impact</h3>
      <div class="impact-metrics">
        <div class="impact-metric">
          <div class="big">${data.totalCO2SavedKg} kg</div>
          <div class="label">CO₂ Saved</div>
        </div>
        <div class="impact-metric">
          <div class="big">${data.equivalents.treeDaysOfAbsorption}</div>
          <div class="label">Tree-days of absorption</div>
        </div>
        <div class="impact-metric">
          <div class="big">${data.equivalents.carKmNotDriven} km</div>
          <div class="label">Car trips avoided</div>
        </div>
      </div>
      <div class="impact-message">${data.message}</div>
    `;

    addScore(10);
    resultEl.scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    alert("Failed to calculate impact. Please ensure the backend is running.");
  }
}

// ── Session Score ──────────────────────────────────────────────
function addScore(pts) {
  sessionScore += pts;
  document.getElementById("sessionScore").textContent = `${sessionScore} pts`;
}

// ── Init ───────────────────────────────────────────────────────
loadProducts();
// Ensure shop tab content visible on start
document.getElementById("tab-shop").classList.remove("hidden");
document.getElementById("products-section").classList.remove("hidden");
