const API_BASE = "https://eco-cart-frontend.onrender.com/api";
let sessionScore = 0;
let chatHistory = [];
let allProducts = [];
let searchTimeout = null;
const counters = { bottles: 0, bags: 0, cups: 0, towels: 0, clothes: 0, electronics: 0 };

// ── Styles ────────────────────────────────────────────────────
const style = document.createElement("style");
style.textContent = `
  .buy-btn {
    display:inline-flex;align-items:center;justify-content:center;
    gap:0.4rem;padding:0.6rem 1rem;background:var(--green-mid);color:white;
    border-radius:50px;font-size:0.82rem;font-weight:600;text-decoration:none;
    transition:0.3s ease;border:none;cursor:pointer;flex:1;
  }
  .buy-btn:hover{background:var(--green-deep);transform:translateY(-1px);}
  .analyze-btn{
    flex:1;padding:0.6rem 1rem;background:var(--green-ghost);color:var(--green-mid);
    border:1.5px solid var(--green-pale);border-radius:50px;font-size:0.82rem;
    font-weight:600;cursor:pointer;transition:0.3s ease;
  }
  .analyze-btn:hover{background:var(--green-pale);}
  .platform-badge{
    font-size:0.68rem;color:var(--text-soft);margin-top:0.3rem;text-align:center;
  }
  .search-panel{
    background:white;border:1px solid var(--border);border-radius:var(--radius);
    padding:1.5rem;margin-bottom:2rem;box-shadow:var(--shadow-lg);
  }
  .search-panel-title{
    font-family:'DM Serif Display',serif;color:var(--green-deep);
    font-size:1.3rem;margin-bottom:1.25rem;
  }
  .search-item{
    display:grid;grid-template-columns:60px 1fr 160px;gap:1rem;align-items:start;
    padding:1.25rem 0;border-bottom:1px solid var(--border);
  }
  .search-item:last-child{border-bottom:none;}
  .si-emoji{font-size:2.2rem;text-align:center;padding-top:0.2rem;}
  .si-name{font-weight:600;font-size:0.95rem;color:var(--text-dark);margin-bottom:0.2rem;}
  .si-meta{font-size:0.78rem;color:var(--text-soft);margin-bottom:0.4rem;}
  .si-score{font-size:0.82rem;color:var(--green-mid);font-weight:600;margin-bottom:0.4rem;}
  .si-desc{font-size:0.82rem;color:var(--text-mid);line-height:1.5;margin-bottom:0.5rem;}
  .si-actions{display:flex;flex-direction:column;gap:0.4rem;}
  .inline-eco{
    background:var(--green-ghost);border:1px solid var(--green-pale);
    border-radius:var(--radius-sm);padding:1rem;margin-top:0.75rem;
  }
  .eco-grade-row{display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;}
  .eco-grade-circle{
    width:44px;height:44px;border-radius:50%;display:flex;flex-direction:column;
    align-items:center;justify-content:center;font-weight:700;font-size:0.9rem;border:2px solid;
  }
  .eco-summary{font-size:0.82rem;color:var(--text-mid);line-height:1.5;margin-bottom:0.5rem;}
  .mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;margin:0.5rem 0;}
  .mini-item{font-size:0.75rem;color:var(--text-mid);}
  .mini-bar{height:4px;background:#e0e0e0;border-radius:99px;margin-top:2px;overflow:hidden;}
  .mini-fill{height:100%;border-radius:99px;}
  .eco-tip{font-size:0.78rem;color:var(--earth);background:var(--amber-light);padding:0.5rem 0.75rem;border-radius:var(--radius-sm);margin-top:0.5rem;}
  .ext-search-row{display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:1rem;}
  .ext-btn{
    display:inline-flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;
    border-radius:50px;font-size:0.82rem;font-weight:600;text-decoration:none;
    transition:0.3s ease;border:2px solid;
  }
  .ext-amazon{background:#ff9900;color:white;border-color:#ff9900;}
  .ext-amazon:hover{background:#e68900;}
  .ext-flipkart{background:#2874f0;color:white;border-color:#2874f0;}
  .ext-flipkart:hover{background:#1a5fd0;}
  .ext-meesho{background:#f43397;color:white;border-color:#f43397;}
  .ext-meesho:hover{background:#d0206e;}
  .no-result-box{
    grid-column:1/-1;text-align:center;padding:3rem 1rem;color:var(--text-soft);
  }
  .no-result-box h3{color:var(--green-deep);margin-bottom:0.75rem;font-family:'DM Serif Display',serif;}
  .analyzing-loader{color:var(--text-soft);font-size:0.85rem;font-style:italic;padding:0.75rem 0;}
`;
document.head.appendChild(style);

// ── Tab Nav ───────────────────────────────────────────────────
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    switchTab(btn.dataset.tab);
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

function switchTab(tab) {
  document.querySelectorAll("[id^='tab-']").forEach(el => el.classList.add("hidden"));
  const sec = document.getElementById(`tab-${tab}`);
  if (sec) sec.classList.remove("hidden");
  const ps = document.getElementById("products-section");
  if (tab === "shop") { ps.classList.remove("hidden"); sec.classList.remove("hidden"); }
  else ps.classList.add("hidden");
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
    renderProductGrid(allProducts);
    populateCategories();
  } catch {
    document.getElementById("productsGrid").innerHTML =
      `<div class="no-result-box"><h3>⚠️ Could not load products</h3><p>Backend may be starting up. Refresh in 30 seconds.</p></div>`;
  }
}

function populateCategories() {
  const cats = [...new Set(allProducts.map(p => p.category))];
  const sel = document.getElementById("categoryFilter");
  sel.innerHTML = `<option value="">All Categories</option>`;
  cats.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);
}

// ── SEARCH — Main function ────────────────────────────────────
function filterProducts() {
  clearTimeout(searchTimeout);
  const search = document.getElementById("searchInput").value.trim();
  const category = document.getElementById("categoryFilter").value;
  const minScore = parseInt(document.getElementById("ecoFilter").value) || 0;

  let filtered = allProducts;
  if (category) filtered = filtered.filter(p => p.category === category);
  if (minScore) filtered = filtered.filter(p => p.ecoScore >= minScore);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.tags||[]).some(t => t.includes(q))
    );
  }

  // Remove old search panel
  document.getElementById("searchPanel")?.remove();

  if (search.length > 1) {
    searchTimeout = setTimeout(() => showSearchPanel(filtered, search), 400);
  } else {
    renderProductGrid(filtered);
  }
}

// ── Search Panel with Buy Links + Auto Analysis ───────────────
async function showSearchPanel(products, query) {
  const grid = document.getElementById("productsGrid");
  document.getElementById("searchPanel")?.remove();

  const panel = document.createElement("div");
  panel.id = "searchPanel";
  panel.className = "search-panel";

  if (!products.length) {
    // Not in catalog — offer external search links
    panel.innerHTML = `
      <div class="search-panel-title">🔍 Searching for "${query}"</div>
      <p style="color:var(--text-soft);font-size:0.9rem;margin-bottom:1rem;">
        Not found in our catalog. Search on Indian eco-friendly stores:
      </p>
      <div class="ext-search-row">
        <a href="https://www.amazon.in/s?k=${encodeURIComponent(query+' eco friendly')}" target="_blank" class="ext-btn ext-amazon">🛒 Amazon.in</a>
        <a href="https://www.flipkart.com/search?q=${encodeURIComponent(query+' eco friendly')}" target="_blank" class="ext-btn ext-flipkart">🛒 Flipkart</a>
        <a href="https://www.meesho.com/search?q=${encodeURIComponent(query+' eco')}" target="_blank" class="ext-btn ext-meesho">🛒 Meesho</a>
        <a href="https://www.indiamart.com/search.mp?ss=${encodeURIComponent(query+' eco friendly')}" target="_blank" class="ext-btn" style="background:#27ae60;color:white;border-color:#27ae60;">🛒 IndiaMART</a>
      </div>
      <div style="margin-top:1.5rem;">
        <button class="btn-primary" onclick="aiAnalyzeQuery('${query.replace(/'/g,"\\'")}')">
          🤖 AI Eco Analyze "${query}"
        </button>
      </div>`;
    grid.parentNode.insertBefore(panel, grid);
    renderProductGrid([]);
    return;
  }

  // Found in catalog
  panel.innerHTML = `
    <div class="search-panel-title">🔍 ${products.length} result${products.length>1?"s":""} for "${query}"</div>
    ${products.map(p => `
      <div class="search-item">
        <div class="si-emoji">${p.image}</div>
        <div>
          <div class="si-name">${p.name}</div>
          <div class="si-meta">${p.brand} · ${p.category} · ${p.currency||"₹"}${p.price}</div>
          <div class="si-score">🌱 Eco Score: ${p.ecoScore}/10</div>
          <div class="si-desc">${p.description}</div>
          <div class="tags-row">${(p.tags||[]).slice(0,3).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
          <div id="eco-inline-${p.id}"></div>
        </div>
        <div class="si-actions">
          <a href="${p.buyLink}" target="_blank" rel="noopener noreferrer" class="buy-btn">🛒 Buy Now</a>
          <div class="platform-badge">on ${p.platform||"Amazon.in"}</div>
          <button class="analyze-btn" style="margin-top:0.25rem;" onclick="inlineAnalyze('${p.id}')">🔍 Eco Analyze</button>
        </div>
      </div>
    `).join("")}
    <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);">
      <p style="font-size:0.82rem;color:var(--text-soft);margin-bottom:0.75rem;">Also search on:</p>
      <div class="ext-search-row">
        <a href="https://www.amazon.in/s?k=${encodeURIComponent(query+' eco friendly')}" target="_blank" class="ext-btn ext-amazon">🛒 More on Amazon.in</a>
        <a href="https://www.flipkart.com/search?q=${encodeURIComponent(query+' eco friendly')}" target="_blank" class="ext-btn ext-flipkart">🛒 More on Flipkart</a>
      </div>
    </div>
  `;

  grid.parentNode.insertBefore(panel, grid);
  renderProductGrid(products);

  // Auto-analyze if single result
  if (products.length === 1) {
    setTimeout(() => inlineAnalyze(products[0].id), 500);
  }
}

async function inlineAnalyze(productId) {
  const p = allProducts.find(x => x.id === productId);
  if (!p) return;
  const container = document.getElementById(`eco-inline-${productId}`);
  if (!container) return;
  container.innerHTML = `<div class="analyzing-loader">🤖 Analyzing eco impact of ${p.name}…</div>`;
  try {
    const res = await fetch(`${API_BASE}/analysis/product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: p.name, brand: p.brand, category: p.category, description: p.description }),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const gc = { "A+":"#00c853",A:"#43a047",B:"#8bc34a",C:"#ffc107",D:"#ff7043",F:"#f44336" };
    const color = gc[data.grade] || "#888";
    const f = data.factors || {};
    const fc = v => v>=8?"#4a8c5c":v>=6?"#8bc34a":v>=4?"#ffc107":"#f44336";
    container.innerHTML = `
      <div class="inline-eco">
        <div class="eco-grade-row">
          <div class="eco-grade-circle" style="border-color:${color};color:${color};">
            <span style="font-size:1rem;">${data.ecoScore}</span>
            <span style="font-size:0.6rem;">/10</span>
          </div>
          <div>
            <div style="font-weight:700;color:${color};">Grade ${data.grade} — ${data.ecoScore>=8?"Excellent":data.ecoScore>=6?"Good":data.ecoScore>=4?"Average":"Poor"}</div>
            <div style="font-size:0.75rem;color:var(--text-soft);">AI Eco Analysis</div>
          </div>
        </div>
        <div class="eco-summary">${data.summary||""}</div>
        <div class="mini-grid">
          ${Object.entries(f).map(([k,v])=>`
            <div class="mini-item">
              ${k.replace(/([A-Z])/g,' $1').trim()}: <strong>${v}/10</strong>
              <div class="mini-bar"><div class="mini-fill" style="width:${v*10}%;background:${fc(v)};"></div></div>
            </div>`).join("")}
        </div>
        ${data.alternatives?.length?`<div style="font-size:0.78rem;color:var(--text-mid);margin-top:0.5rem;">🌱 <strong>Greener:</strong> ${data.alternatives.slice(0,2).map(a=>a.name).join(", ")}</div>`:""}
        ${data.tip?`<div class="eco-tip">💡 ${data.tip}</div>`:""}
      </div>`;
    addScore(3);
  } catch {
    container.innerHTML = `<div style="color:#e53935;font-size:0.78rem;padding:0.4rem;">⚠️ Analysis unavailable. <button onclick="inlineAnalyze('${productId}')" style="color:var(--green-mid);background:none;border:none;cursor:pointer;font-size:0.78rem;">Retry</button></div>`;
  }
}

function aiAnalyzeQuery(query) {
  switchTab("analyze");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelector('[data-tab="analyze"]').classList.add("active");
  document.getElementById("productName").value = query;
  document.getElementById("productBrand").value = "";
  document.getElementById("productDesc").value = "";
  analyzeProduct();
}

// ── Product Grid ──────────────────────────────────────────────
function renderProductGrid(products) {
  const grid = document.getElementById("productsGrid");
  if (!products.length) {
    grid.innerHTML = `<div class="no-result-box"><p>No products match. Try a broader search!</p></div>`;
    return;
  }
  grid.innerHTML = products.map(p => `
    <div class="product-card">
      <span class="product-emoji">${p.image||"🌿"}</span>
      <div class="product-name">${p.name}</div>
      <div class="product-brand">${p.brand} · ${p.category}</div>
      <div class="product-desc">${p.description}</div>
      <div class="eco-score-row">
        <div class="eco-score">🌱 ${p.ecoScore}/10</div>
        <div class="product-price">${p.currency||"₹"}${p.price}</div>
      </div>
      <div class="score-bar" style="margin:0.6rem 0;">
        <div class="score-fill" style="width:${p.ecoScore*10}%"></div>
      </div>
      <div class="tags-row">${(p.tags||[]).slice(0,3).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
      <div style="display:flex;gap:0.5rem;margin-top:0.85rem;">
        <a href="${p.buyLink}" target="_blank" rel="noopener noreferrer" class="buy-btn">🛒 Buy Now</a>
        <button class="analyze-btn" onclick="analyzeFromCard('${p.id}')">🔍 Analyze</button>
      </div>
      <div class="platform-badge">Available on ${p.platform||"Amazon.in"}</div>
    </div>
  `).join("");
}

function analyzeFromCard(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  switchTab("analyze");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelector('[data-tab="analyze"]').classList.add("active");
  document.getElementById("productName").value = p.name;
  document.getElementById("productBrand").value = p.brand;
  document.getElementById("productCategory").value = p.category;
  document.getElementById("productDesc").value = p.description;
  analyzeProduct();
}

// ── Analyzer ──────────────────────────────────────────────────
async function analyzeProduct() {
  const name = document.getElementById("productName").value.trim();
  const brand = document.getElementById("productBrand").value.trim();
  const category = document.getElementById("productCategory").value;
  const description = document.getElementById("productDesc").value.trim();
  if (!name) { alert("Please enter a product name."); return; }
  const btn = document.getElementById("analyzeBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Analyzing…`;
  document.getElementById("analyzeResult").classList.add("hidden");
  try {
    const res = await fetch(`${API_BASE}/analysis/product`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name,brand,category,description}),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderAnalysis(data, name);
    addScore(data.ecoScore);
  } catch {
    const r = document.getElementById("analyzeResult");
    r.classList.remove("hidden");
    r.innerHTML = `<p style="color:#e53935;padding:1rem;">⚠️ Analysis failed. Please try again.</p>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>🔍 Analyze Eco Impact</span>`;
  }
}

function renderAnalysis(data, name) {
  const r = document.getElementById("analyzeResult");
  r.classList.remove("hidden");
  const ge = {"A+":"🌟",A:"✅",B:"👍",C:"🟡",D:"⚠️",F:"🚫"};
  const fc = v => v>=8?"#4a8c5c":v>=6?"#8bc34a":v>=4?"#ffc107":"#f44336";
  const f = data.factors||{};
  const fn = {carbonFootprint:"Carbon Footprint",recyclability:"Recyclability",materials:"Materials",packaging:"Packaging",durability:"Durability",ethicalProduction:"Ethical Production"};
  r.innerHTML = `
    <div style="text-align:center;">
      <div class="result-score-circle" style="border-color:${data.gradeColor};color:${data.gradeColor};background:${data.gradeColor}10;">
        <span>${data.ecoScore||"?"}</span><span style="font-size:0.9rem;font-family:'DM Sans';">/10</span>
      </div>
      <div style="font-size:1.3rem;margin-bottom:0.25rem;">${ge[data.grade]||""} Grade: <strong>${data.grade||"?"}</strong></div>
      <div style="font-size:0.85rem;color:var(--text-soft);margin-bottom:1rem;">${name}</div>
      <p style="font-size:0.9rem;color:var(--text-mid);line-height:1.6;margin-bottom:1.5rem;">${data.summary||""}</p>
    </div>
    <div class="result-factors">
      ${Object.entries(fn).map(([k,l])=>{const v=f[k]||0;return`<div class="factor-row"><span class="factor-label">${l}</span><div class="factor-bar"><div class="factor-fill" style="width:${v*10}%;background:${fc(v)};"></div></div><span class="factor-num">${v}</span></div>`;}).join("")}
    </div>
    <div class="result-lists">
      <div class="result-list"><h4>✅ Positives</h4><ul>${(data.positives||[]).map(p=>`<li><span>•</span>${p}</li>`).join("")||"<li>None</li>"}</ul></div>
      <div class="result-list"><h4>⚠️ Concerns</h4><ul>${(data.concerns||[]).map(c=>`<li><span>•</span>${c}</li>`).join("")||"<li>None</li>"}</ul></div>
    </div>
    ${data.alternatives?.length?`<div style="margin:1.25rem 0;"><h4 style="font-size:0.85rem;color:var(--text-mid);margin-bottom:0.5rem;">🌱 Greener Alternatives</h4>${data.alternatives.map(a=>`<div style="padding:0.5rem 0;border-bottom:1px solid var(--border);font-size:0.85rem;"><strong>${a.name}</strong> — ${a.reason}</div>`).join("")}</div>`:""}
    ${data.certifications?.length?`<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:1rem;">${data.certifications.map(c=>`<span class="tag">🏷️ ${c}</span>`).join("")}</div>`:""}
    ${data.tip?`<div class="result-tip">💡 <strong>Tip:</strong> ${data.tip}</div>`:""}
  `;
}

// ── Chat ──────────────────────────────────────────────────────
async function sendChat() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;
  input.value = "";
  appendMessage("user", msg);
  chatHistory.push({role:"user",content:msg});
  const typing = appendMessage("bot","Thinking… 🌿",true);
  try {
    const res = await fetch(`${API_BASE}/assistant/chat`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({messages:chatHistory.slice(-8),userMessage:msg}),
    });
    typing.remove();
    if (!res.ok) throw new Error();
    const data = await res.json();
    appendMessage("bot", data.reply);
    chatHistory.push({role:"assistant",content:data.reply});
    addScore(2);
  } catch {
    typing.remove();
    appendMessage("bot","⚠️ Could not connect. Please try again.");
  }
}

function appendMessage(role, text, isTyping=false) {
  const c = document.getElementById("chatMessages");
  const el = document.createElement("div");
  el.className = `message ${role}${isTyping?" typing":""}`;
  const now = new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  el.innerHTML = `<div class="message-bubble">${text.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")}</div><span class="message-time">${now}</span>`;
  c.appendChild(el);
  c.scrollTop = c.scrollHeight;
  return el;
}

function sendSuggestion(btn) {
  document.getElementById("chatInput").value = btn.textContent;
  sendChat();
}

// ── Impact Calculator ──────────────────────────────────────────
function adjust(key, delta) {
  counters[key] = Math.max(0,(counters[key]||0)+delta);
  document.getElementById(`${key}-val`).textContent = counters[key];
}

async function calculateImpact() {
  const total = Object.values(counters).reduce((a,b)=>a+b,0);
  if (!total) { alert("Adjust at least one counter first."); return; }
  const params = new URLSearchParams({
    plasticBottles:counters.bottles,
    plasticBags:counters.bags,
    disposableCups:counters.cups,
    paperTowels:counters.towels,
    clothingItems:counters.clothes,
    electronics:counters.electronics,
  });
  try {
    const res = await fetch(`${API_BASE}/analysis/impact-calculator?${params}`);
    const data = await res.json();
    const r = document.getElementById("impactResult");
    r.classList.remove("hidden");
    r.innerHTML = `
      <h3>🌍 Your Monthly Impact</h3>
      <div class="impact-metrics">
        <div class="impact-metric"><div class="big">${data.totalCO2SavedKg} kg</div><div class="label">CO₂ Saved</div></div>
        <div class="impact-metric"><div class="big">${data.equivalents.treeDaysOfAbsorption}</div><div class="label">Tree-days absorbed</div></div>
        <div class="impact-metric"><div class="big">${data.equivalents.carKmNotDriven} km</div><div class="label">Car trips avoided</div></div>
        <div class="impact-metric"><div class="big">${Math.round(data.totalCO2SavedKg*1000)} g</div><div class="label">CO₂ in grams</div></div>
      </div>
      <div class="impact-message">${data.message}</div>
    `;
    addScore(10);
    r.scrollIntoView({behavior:"smooth"});
  } catch { alert("Failed to calculate. Please try again."); }
}

function addScore(pts) {
  sessionScore += pts;
  document.getElementById("sessionScore").textContent = `${sessionScore} pts`;
}

// ── Init ──────────────────────────────────────────────────────
loadProducts();
document.getElementById("tab-shop").classList.remove("hidden");
document.getElementById("products-section").classList.remove("hidden");
