const API_BASE = "https://eco-cart-frontend.onrender.com/api";
let sessionScore = 0;
let chatHistory = [];
const counters = { bottles: 0, bags: 0, cups: 0, towels: 0 };
let allProducts = [];
let searchTimeout = null;

// ── Inject extra styles ───────────────────────────────────────
const style = document.createElement("style");
style.textContent = `
  .buy-btn {
    display:inline-flex; align-items:center; justify-content:center;
    gap:0.4rem; padding:0.55rem 1rem;
    background:var(--green-mid); color:white;
    border-radius:50px; font-size:0.82rem; font-weight:600;
    text-decoration:none; transition:0.3s ease; border:none; cursor:pointer; width:100%;
  }
  .buy-btn:hover { background:var(--green-deep); transform:translateY(-1px); }
  .analyze-btn {
    width:100%; padding:0.55rem 1rem;
    background:var(--green-ghost); color:var(--green-mid);
    border:1.5px solid var(--green-pale); border-radius:50px;
    font-size:0.82rem; font-weight:600; cursor:pointer; transition:0.3s ease;
  }
  .analyze-btn:hover { background:var(--green-pale); }
  .search-results-panel {
    background:white; border:1px solid var(--border);
    border-radius:var(--radius); padding:1.5rem;
    margin-bottom:2rem; box-shadow:var(--shadow-lg);
  }
  .search-results-panel h3 {
    font-family:'DM Serif Display',serif; color:var(--green-deep);
    margin-bottom:1rem; font-size:1.3rem;
  }
  .search-result-item {
    display:grid; grid-template-columns:auto 1fr auto;
    gap:1rem; align-items:center;
    padding:1rem; border-bottom:1px solid var(--border);
    transition:0.2s;
  }
  .search-result-item:last-child { border-bottom:none; }
  .search-result-item:hover { background:var(--green-ghost); border-radius:var(--radius-sm); }
  .sri-emoji { font-size:2rem; }
  .sri-name { font-weight:600; font-size:0.95rem; color:var(--text-dark); }
  .sri-brand { font-size:0.8rem; color:var(--text-soft); }
  .sri-score { font-size:0.82rem; color:var(--green-mid); font-weight:600; }
  .sri-actions { display:flex; flex-direction:column; gap:0.4rem; min-width:120px; }
  .inline-analysis {
    background:var(--green-ghost); border:1px solid var(--green-pale);
    border-radius:var(--radius); padding:1.5rem; margin-top:1rem;
  }
  .inline-analysis h4 { color:var(--green-deep); margin-bottom:1rem; font-size:1rem; }
  .mini-factors { display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin:0.75rem 0; }
  .mini-factor { font-size:0.78rem; color:var(--text-mid); }
  .mini-bar { height:5px; background:#e0e0e0; border-radius:99px; margin-top:3px; overflow:hidden; }
  .mini-fill { height:100%; border-radius:99px; background:var(--green-light); }
  .loading-analysis {
    text-align:center; padding:1.5rem; color:var(--text-soft);
    font-style:italic; font-size:0.9rem;
  }
  .no-results {
    text-align:center; padding:3rem; color:var(--text-soft);
    font-size:0.95rem; grid-column:1/-1;
  }
`;
document.head.appendChild(style);

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

// ── Load Products ─────────────────────────────────────────────
async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    const data = await res.json();
    allProducts = data.products || [];
    renderProducts(allProducts);
    populateCategories();
  } catch (err) {
    document.getElementById("productsGrid").innerHTML =
      `<div class="no-results">⚠️ Could not load products. Make sure the backend is running.</div>`;
  }
}

function populateCategories() {
  const categories = [...new Set(allProducts.map((p) => p.category))];
  const select = document.getElementById("categoryFilter");
  select.innerHTML = `<option value="">All Categories</option>`;
  categories.forEach((cat) => {
    select.innerHTML += `<option value="${cat}">${cat}</option>`;
  });
}

// ── Search with live results + auto analysis ──────────────────
function filterProducts() {
  clearTimeout(searchTimeout);
  const search = document.getElementById("searchInput").value.toLowerCase().trim();
  const category = document.getElementById("categoryFilter").value;
  const minScore = parseInt(document.getElementById("ecoFilter").value) || 0;

  let filtered = allProducts;
  if (category) filtered = filtered.filter((p) => p.category === category);
  if (minScore) filtered = filtered.filter((p) => p.ecoScore >= minScore);
  if (search) {
    filtered = filtered.filter((p) =>
      p.name.toLowerCase().includes(search) ||
      p.brand.toLowerCase().includes(search) ||
      p.description.toLowerCase().includes(search) ||
      p.category.toLowerCase().includes(search) ||
      (p.tags || []).some((t) => t.includes(search))
    );
  }

  // If search text entered, show search results panel with auto-analysis
  if (search.length > 1) {
    searchTimeout = setTimeout(() => showSearchResults(filtered, search), 300);
  } else {
    // Remove search panel if exists
    const existing = document.getElementById("searchResultsPanel");
    if (existing) existing.remove();
    renderProducts(filtered);
  }
}

async function showSearchResults(products, query) {
  const grid = document.getElementById("productsGrid");

  // Remove existing search panel
  const existing = document.getElementById("searchResultsPanel");
  if (existing) existing.remove();

  if (!products.length) {
    // Search online products not in our catalog
    grid.innerHTML = `
      <div class="no-results">
        🔍 No products found for "<strong>${query}</strong>" in our catalog.<br/>
        <br/>
        <button class="btn-primary" style="margin-top:1rem;" onclick="searchOnlineProduct('${query}')">
          🤖 AI Analyze "${query}" 
        </button>
        <br/><br/>
        <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
          <a href="https://www.amazon.in/s?k=${encodeURIComponent(query)}+eco+friendly" target="_blank" class="buy-btn" style="width:auto;padding:0.5rem 1.2rem;">🛒 Search Amazon.in</a>
          <a href="https://www.flipkart.com/search?q=${encodeURIComponent(query)}+eco+friendly" target="_blank" class="buy-btn" style="width:auto;padding:0.5rem 1.2rem;background:#2874f0;">🛒 Search Flipkart</a>
        </div>
      </div>`;
    return;
  }

  // Show search panel above grid
  const panel = document.createElement("div");
  panel.id = "searchResultsPanel";
  panel.className = "search-results-panel";
  panel.innerHTML = `
    <h3>🔍 Search Results for "${query}" (${products.length} found)</h3>
    ${products.map(p => `
      <div class="search-result-item" id="sri-${p.id}">
        <div class="sri-emoji">${p.image}</div>
        <div>
          <div class="sri-name">${p.name}</div>
          <div class="sri-brand">${p.brand} · ${p.category}</div>
          <div class="sri-score">🌱 Eco Score: ${p.ecoScore}/10 · ${p.currency || "₹"}${p.price}</div>
          <div class="tags-row" style="margin-top:0.4rem;">
            ${(p.tags||[]).slice(0,3).map(t=>`<span class="tag">${t}</span>`).join("")}
          </div>
          <div id="analysis-${p.id}"></div>
        </div>
        <div class="sri-actions">
          <a href="${p.buyLink}" target="_blank" rel="noopener noreferrer" class="buy-btn">🛒 Buy on India</a>
          <button class="analyze-btn" onclick="analyzeSearchProduct('${p.id}')">🔍 Eco Analyze</button>
        </div>
      </div>
    `).join("")}
  `;
  grid.parentNode.insertBefore(panel, grid);

  // Auto-render all products below too
  renderProducts(products);

  // Auto-analyze top result
  if (products.length === 1) {
    analyzeSearchProduct(products[0].id);
  }
}

async function analyzeSearchProduct(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const container = document.getElementById(`analysis-${productId}`);
  if (!container) return;

  container.innerHTML = `<div class="loading-analysis">🤖 Analyzing eco impact…</div>`;

  try {
    const res = await fetch(`${API_BASE}/analysis/product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: product.name,
        brand: product.brand,
        category: product.category,
        description: product.description,
      }),
    });

    if (!res.ok) throw new Error("Analysis failed");
    const data = await res.json();

    const gradeColors = { "A+":"#00c853",A:"#43a047",B:"#8bc34a",C:"#ffc107",D:"#ff7043",F:"#f44336" };
    const color = gradeColors[data.grade] || "#888";
    const factors = data.factors || {};

    container.innerHTML = `
      <div class="inline-analysis">
        <h4>🌿 Eco Analysis — Grade: <span style="color:${color};font-weight:700;">${data.grade}</span> (${data.ecoScore}/10)</h4>
        <p style="font-size:0.85rem;color:var(--text-mid);margin-bottom:0.75rem;">${data.summary}</p>
        <div class="mini-factors">
          ${Object.entries(factors).map(([k,v]) => `
            <div class="mini-factor">
              ${k.replace(/([A-Z])/g,' $1').trim()}: <strong>${v}/10</strong>
              <div class="mini-bar"><div class="mini-fill" style="width:${v*10}%"></div></div>
            </div>`).join("")}
        </div>
        ${data.tip ? `<div class="result-tip" style="margin-top:0.75rem;">💡 ${data.tip}</div>` : ""}
        ${data.alternatives?.length ? `
          <div style="margin-top:0.75rem;font-size:0.82rem;color:var(--text-mid);">
            <strong>🌱 Greener alternatives:</strong> ${data.alternatives.map(a=>a.name).join(", ")}
          </div>` : ""}
      </div>
    `;
    addScore(3);
  } catch (err) {
    container.innerHTML = `<div style="color:#e53935;font-size:0.82rem;padding:0.5rem;">⚠️ Analysis failed. Try again.</div>`;
  }
}

async function searchOnlineProduct(query) {
  switchTab("analyze");
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  document.querySelector('[data-tab="analyze"]').classList.add("active");
  document.getElementById("productName").value = query;
  document.getElementById("productDesc").value = "";
  analyzeProduct();
}

// ── Render Product Cards ──────────────────────────────────────
function renderProducts(products) {
  const grid = document.getElementById("productsGrid");
  if (!products.length) {
    grid.innerHTML = `<div class="no-results">No products found.</div>`;
    return;
  }
  grid.innerHTML = products.map((p) => `
    <div class="product-card">
      <span class="product-emoji">${p.image || "🌿"}</span>
      <div class="product-name">${p.name}</div>
      <div class="product-brand">${p.brand} · ${p.category}</div>
      <div class="product-desc">${p.description}</div>
      <div class="eco-score-row">
        <div class="eco-score">🌱 ${p.ecoScore}/10</div>
        <div class="product-price">${p.currency || "₹"}${p.price}</div>
      </div>
      <div class="score-bar" style="margin:0.6rem 0;">
        <div class="score-fill" style="width:${p.ecoScore*10}%"></div>
      </div>
      <div class="tags-row">${(p.tags||[]).slice(0,3).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
      <div style="display:flex;gap:0.5rem;margin-top:0.85rem;">
        <a href="${p.buyLink}" target="_blank" rel="noopener noreferrer" class="buy-btn">🛒 Buy Now</a>
        <button class="analyze-btn" onclick="analyzeFromCard('${p.id}')">🔍 Analyze</button>
      </div>
    </div>
  `).join("");
}

function analyzeFromCard(id) {
  const p = allProducts.find((x) => x.id === id);
  if (!p) return;
  switchTab("analyze");
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  document.querySelector('[data-tab="analyze"]').classList.add("active");
  document.getElementById("productName").value = p.name;
  document.getElementById("productBrand").value = p.brand;
  document.getElementById("productCategory").value = p.category;
  document.getElementById("productDesc").value = p.description;
  analyzeProduct();
}

// ── AI Product Analyzer ───────────────────────────────────────
async function analyzeProduct() {
  const name = document.getElementById("productName").value.trim();
  const brand = document.getElementById("productBrand").value.trim();
  const category = document.getElementById("productCategory").value;
  const description = document.getElementById("productDesc").value.trim();

  if (!name) { alert("Please enter a product name."); return; }

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
    resultEl.innerHTML = `<p style="color:#e53935;padding:1rem;">⚠️ Failed to analyze. Please ensure backend is running.</p>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>🔍 Analyze Eco Impact</span>`;
  }
}

function renderAnalysis(data, productName) {
  const resultEl = document.getElementById("analyzeResult");
  resultEl.classList.remove("hidden");
  const gradeEmoji = {"A+":"🌟",A:"✅",B:"👍",C:"🟡",D:"⚠️",F:"🚫"};
  const factorColors = (v) => v>=8?"#4a8c5c":v>=6?"#8bc34a":v>=4?"#ffc107":"#f44336";
  const factors = data.factors || {};
  const factorNames = {carbonFootprint:"Carbon Footprint",recyclability:"Recyclability",materials:"Materials",packaging:"Packaging",durability:"Durability",ethicalProduction:"Ethical Production"};
  resultEl.innerHTML = `
    <div style="text-align:center;">
      <div class="result-score-circle" style="border-color:${data.gradeColor};color:${data.gradeColor};background:${data.gradeColor}10;">
        <span>${data.ecoScore||"?"}</span><span style="font-size:0.9rem;font-family:'DM Sans';">/10</span>
      </div>
      <div style="font-size:1.3rem;margin-bottom:0.25rem;">${gradeEmoji[data.grade]||""} Grade: <strong>${data.grade||"?"}</strong></div>
      <div style="font-size:0.85rem;color:var(--text-soft);margin-bottom:1.5rem;">${productName}</div>
      <p style="font-size:0.9rem;color:var(--text-mid);line-height:1.6;margin-bottom:1.5rem;">${data.summary||""}</p>
    </div>
    <div class="result-factors">
      ${Object.entries(factorNames).map(([key,label])=>{const val=factors[key]||0;return`<div class="factor-row"><span class="factor-label">${label}</span><div class="factor-bar"><div class="factor-fill" style="width:${val*10}%;background:${factorColors(val)};"></div></div><span class="factor-num">${val}</span></div>`;}).join("")}
    </div>
    <div class="result-lists">
      <div class="result-list"><h4>✅ Positives</h4><ul>${(data.positives||[]).map(p=>`<li><span>•</span>${p}</li>`).join("")||"<li>None noted</li>"}</ul></div>
      <div class="result-list"><h4>⚠️ Concerns</h4><ul>${(data.concerns||[]).map(c=>`<li><span>•</span>${c}</li>`).join("")||"<li>None noted</li>"}</ul></div>
    </div>
    ${data.alternatives?.length?`<div style="margin:1.25rem 0;"><h4 style="font-size:0.85rem;color:var(--text-mid);margin-bottom:0.5rem;">🌱 Greener Alternatives</h4>${data.alternatives.map(a=>`<div style="padding:0.6rem 0;border-bottom:1px solid var(--border);font-size:0.85rem;"><strong>${a.name}</strong> — ${a.reason}</div>`).join("")}</div>`:""}
    ${data.certifications?.length?`<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:1rem;">${data.certifications.map(c=>`<span class="tag">🏷️ ${c}</span>`).join("")}</div>`:""}
    ${data.tip?`<div class="result-tip">💡 <strong>Tip:</strong> ${data.tip}</div>`:""}
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
  const typingEl = appendMessage("bot", "Thinking… 🌿", true);
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
    appendMessage("bot", "⚠️ Sorry, couldn't connect to server.");
  }
}

function appendMessage(role, text, isTyping = false) {
  const container = document.getElementById("chatMessages");
  const el = document.createElement("div");
  el.className = `message ${role}${isTyping?" typing":""}`;
  const now = new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  el.innerHTML = `<div class="message-bubble">${text.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")}</div><span class="message-time">${now}</span>`;
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
  counters[key] = Math.max(0, (counters[key]||0) + delta);
  document.getElementById(`${key}-val`).textContent = counters[key];
}

async function calculateImpact() {
  const total = Object.values(counters).reduce((a,b)=>a+b,0);
  if (total===0) { alert("Please adjust at least one counter."); return; }
  const params = new URLSearchParams({plasticBottles:counters.bottles,plasticBags:counters.bags,disposableCups:counters.cups,paperTowels:counters.towels});
  try {
    const res = await fetch(`${API_BASE}/analysis/impact-calculator?${params}`);
    const data = await res.json();
    const resultEl = document.getElementById("impactResult");
    resultEl.classList.remove("hidden");
    resultEl.innerHTML = `
      <h3>🌍 Your Monthly Impact</h3>
      <div class="impact-metrics">
        <div class="impact-metric"><div class="big">${data.totalCO2SavedKg} kg</div><div class="label">CO₂ Saved</div></div>
        <div class="impact-metric"><div class="big">${data.equivalents.treeDaysOfAbsorption}</div><div class="label">Tree-days of absorption</div></div>
        <div class="impact-metric"><div class="big">${data.equivalents.carKmNotDriven} km</div><div class="label">Car trips avoided</div></div>
      </div>
      <div class="impact-message">${data.message}</div>
    `;
    addScore(10);
    resultEl.scrollIntoView({behavior:"smooth"});
  } catch(err) { alert("Failed to calculate impact."); }
}

function addScore(pts) {
  sessionScore += pts;
  document.getElementById("sessionScore").textContent = `${sessionScore} pts`;
}

// ── Init ───────────────────────────────────────────────────────
loadProducts();
document.getElementById("tab-shop").classList.remove("hidden");
document.getElementById("products-section").classList.remove("hidden");
