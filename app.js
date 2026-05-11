const API_BASE = "https://eco-cart-frontend.onrender.com/api";
let sessionScore = 0;
let chatHistory = [];
let searchTimeout = null;
const counters = { bottles: 0, bags: 0, cups: 0, towels: 0 };

// ── Styles ────────────────────────────────────────────────────
const style = document.createElement("style");
style.textContent = `
  .buy-btn {
    display:inline-flex;align-items:center;justify-content:center;
    gap:0.4rem;padding:0.55rem 1rem;background:var(--green-mid);color:white;
    border-radius:50px;font-size:0.82rem;font-weight:600;text-decoration:none;
    transition:0.3s ease;border:none;cursor:pointer;flex:1;
  }
  .buy-btn:hover{background:var(--green-deep);transform:translateY(-1px);}
  .analyze-btn{
    flex:1;padding:0.55rem 1rem;background:var(--green-ghost);color:var(--green-mid);
    border:1.5px solid var(--green-pale);border-radius:50px;font-size:0.82rem;
    font-weight:600;cursor:pointer;transition:0.3s ease;
  }
  .analyze-btn:hover{background:var(--green-pale);}

  .product-img {
    width:100%;height:180px;object-fit:contain;padding:0.75rem;background:#f9f9f9;
    border-radius:var(--radius) var(--radius) 0 0;
  }
  .product-img-placeholder {
    width:100%;height:180px;display:flex;align-items:center;justify-content:center;
    font-size:3.5rem;background:var(--green-ghost);
    border-radius:var(--radius) var(--radius) 0 0;
  }

  .search-state {
    grid-column:1/-1;text-align:center;padding:4rem 2rem;
  }
  .search-state h3 {
    font-family:'DM Serif Display',serif;color:var(--green-deep);
    font-size:1.8rem;margin-bottom:0.75rem;
  }
  .search-state p { color:var(--text-soft);font-size:0.95rem;margin-bottom:1.5rem; }

  .loading-spinner {
    grid-column:1/-1;text-align:center;padding:4rem;
    color:var(--text-soft);font-size:1rem;
  }
  .loading-spinner .spin {
    display:inline-block;width:32px;height:32px;border:3px solid var(--green-pale);
    border-top-color:var(--green-mid);border-radius:50%;
    animation:spin 0.8s linear infinite;margin-bottom:1rem;
  }
  @keyframes spin{to{transform:rotate(360deg)}}

  .platform-badge {
    font-size:0.68rem;color:var(--text-soft);text-align:center;margin-top:0.3rem;
  }
  .sr-analysis {
    background:var(--green-ghost);border-top:1px solid var(--green-pale);
    padding:1rem;display:none;border-radius:0 0 var(--radius) var(--radius);
  }
  .sr-analysis.open{display:block;}
  .sra-grade-row{display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;}
  .sra-badge{
    width:42px;height:42px;border-radius:50%;display:flex;flex-direction:column;
    align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;
    border:2px solid;flex-shrink:0;
  }
  .sra-factors{display:grid;grid-template-columns:1fr 1fr;gap:0.35rem;margin:0.5rem 0;}
  .sra-factor{font-size:0.72rem;color:var(--text-mid);}
  .sra-bar{height:4px;background:#ddd;border-radius:99px;margin-top:2px;overflow:hidden;}
  .sra-fill{height:100%;border-radius:99px;}
  .sra-tip{font-size:0.72rem;color:var(--earth);background:var(--amber-light);
    padding:0.4rem 0.6rem;border-radius:6px;margin-top:0.4rem;}

  .ext-row{
    grid-column:1/-1;display:flex;gap:0.75rem;flex-wrap:wrap;
    padding:1.5rem;background:white;border:1px solid var(--border);
    border-radius:var(--radius);align-items:center;
  }
  .ext-label{font-size:0.82rem;font-weight:600;color:var(--text-mid);}
  .ext-btn{
    display:inline-flex;align-items:center;gap:0.35rem;padding:0.45rem 1rem;
    border-radius:50px;font-size:0.8rem;font-weight:600;text-decoration:none;transition:0.2s;
  }
  .ext-amazon{background:#ff9900;color:white;}
  .ext-flipkart{background:#2874f0;color:white;}
  .ext-meesho{background:#f43397;color:white;}
  .ext-nykaa{background:#fc2779;color:white;}
  .ext-indiamart{background:#27ae60;color:white;}
  .product-rating{font-size:0.75rem;color:#f39c12;margin-bottom:0.4rem;}
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

// ── Init — show empty state ───────────────────────────────────
function initShop() {
  populateCategories();
  showEmptyState();
}

function populateCategories() {
  const sel = document.getElementById("categoryFilter");
  const cats = ["Personal Care","Kitchen","Clothing","Electronics","Cleaning","Home & Garden","Stationery","Food & Beverage","Kids","Sports & Fitness"];
  sel.innerHTML = `<option value="">All Categories</option>`;
  cats.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);
}

function showEmptyState() {
  const grid = document.getElementById("productsGrid");
  grid.innerHTML = `
    <div class="search-state">
      <h3>🌿 Discover Eco Products</h3>
      <p>Search for any product above or select a category to find eco-friendly options from Indian stores</p>
      <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;">
        <button class="btn-ghost" onclick="quickSearch('bamboo toothbrush')">🪥 Bamboo Toothbrush</button>
        <button class="btn-ghost" onclick="quickSearch('steel water bottle')">🥤 Steel Bottle</button>
        <button class="btn-ghost" onclick="quickSearch('organic cotton')">👕 Organic Cotton</button>
        <button class="btn-ghost" onclick="quickSearch('solar charger')">☀️ Solar Charger</button>
        <button class="btn-ghost" onclick="quickSearch('jute bag')">👜 Jute Bag</button>
      </div>
    </div>
  `;
}

function quickSearch(term) {
  document.getElementById("searchInput").value = term;
  filterProducts();
}

// ── FILTER & SEARCH ───────────────────────────────────────────
function filterProducts() {
  clearTimeout(searchTimeout);
  const search = document.getElementById("searchInput").value.trim();
  const category = document.getElementById("categoryFilter").value;
  const minScore = parseInt(document.getElementById("ecoFilter").value) || 0;

  if (!search && !category) {
    showEmptyState();
    return;
  }

  const query = search || category;
  searchTimeout = setTimeout(() => fetchProducts(query, category, minScore), 400);
}

// ── Fetch real products ───────────────────────────────────────
async function fetchProducts(query, category, minScore) {
  const grid = document.getElementById("productsGrid");

  // Show loading
  grid.innerHTML = `
    <div class="loading-spinner">
      <div class="spin"></div>
      <div>Searching eco-friendly "${query}" products…</div>
    </div>
  `;

  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query + " eco friendly india")}`);
    const data = await res.json();

    if (data.source === "amazon" && data.products?.length) {
      let products = data.products;

      // Filter by eco score if set (AI pre-scored)
      if (minScore > 0) {
        products = products.filter(p => (p.ecoScore || 5) >= minScore);
      }

      renderRealProducts(products, query);
    } else {
      // No API key — show search links
      showExternalLinks(query);
    }
  } catch {
    showExternalLinks(query);
  }
}

// ── Render real products from Amazon ─────────────────────────
function renderRealProducts(products, query) {
  const grid = document.getElementById("productsGrid");

  if (!products.length) {
    showExternalLinks(query);
    return;
  }

  grid.innerHTML = products.map((p, i) => `
    <div class="product-card" style="padding:0;overflow:hidden;" id="pc-${i}">
      ${p.image
        ? `<img src="${p.image}" class="product-img" alt="${p.name}" onerror="this.parentNode.querySelector('.product-img-placeholder').style.display='flex';this.style.display='none'" /><div class="product-img-placeholder" style="display:none;">🌿</div>`
        : `<div class="product-img-placeholder">🌿</div>`}
      <div style="padding:1rem;flex:1;display:flex;flex-direction:column;">
        <div class="product-name">${p.name}</div>
        <div class="product-brand">${p.brand || "Amazon.in"}</div>
        ${p.rating ? `<div class="product-rating">⭐ ${p.rating} ${p.reviews ? `(${Number(p.reviews).toLocaleString()} reviews)` : ""}</div>` : ""}
        <div class="eco-score-row" style="margin:0.5rem 0;">
          <div class="product-price" style="font-size:1.1rem;font-weight:700;color:var(--green-deep);">${p.price || "View price"}</div>
        </div>
        <div style="display:flex;gap:0.5rem;margin-top:auto;padding-top:0.75rem;">
          <a href="${p.buyLink}" target="_blank" rel="noopener noreferrer" class="buy-btn">🛒 Buy Now</a>
          <button class="analyze-btn" onclick="analyzeCard(${i},'${p.name.replace(/'/g,"\\'").replace(/"/g,'\\"').substring(0,60)}','${(p.brand||"").replace(/'/g,"\\'")}')">🔍 Eco Score</button>
        </div>
        <div class="platform-badge">Available on Amazon.in</div>
      </div>
      <div class="sr-analysis" id="sra-${i}"></div>
    </div>
  `).join("") + `
    <div class="ext-row">
      <span class="ext-label">Also search on:</span>
      ${buildExtBtns(query)}
    </div>
  `;
}

// ── Show external links when no API ──────────────────────────
function showExternalLinks(query) {
  const grid = document.getElementById("productsGrid");
  const enc = encodeURIComponent(query);
  grid.innerHTML = `
    <div class="search-state">
      <h3>🛒 Shop "${query}" on Indian Stores</h3>
      <p>Click any store below to see real eco-friendly products directly</p>
      <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;margin-bottom:2rem;">
        <a href="https://www.amazon.in/s?k=${enc}+eco+friendly" target="_blank" class="ext-btn ext-amazon" style="padding:0.65rem 1.5rem;font-size:0.9rem;">🛒 Amazon.in</a>
        <a href="https://www.flipkart.com/search?q=${enc}+eco+friendly" target="_blank" class="ext-btn ext-flipkart" style="padding:0.65rem 1.5rem;font-size:0.9rem;">🛒 Flipkart</a>
        <a href="https://www.meesho.com/search?q=${enc}" target="_blank" class="ext-btn ext-meesho" style="padding:0.65rem 1.5rem;font-size:0.9rem;">🛒 Meesho</a>
        <a href="https://www.nykaa.com/search/result/?q=${enc}" target="_blank" class="ext-btn ext-nykaa" style="padding:0.65rem 1.5rem;font-size:0.9rem;">🛒 Nykaa</a>
        <a href="https://dir.indiamart.com/search.mp?ss=${enc}+eco" target="_blank" class="ext-btn ext-indiamart" style="padding:0.65rem 1.5rem;font-size:0.9rem;">🛒 IndiaMART</a>
      </div>
      <div style="border-top:1px solid var(--border);padding-top:1.5rem;">
        <p style="margin-bottom:0.75rem;color:var(--text-soft);">Or get AI eco analysis for "${query}":</p>
        <button class="btn-primary" onclick="aiAnalyzeQuery('${query.replace(/'/g,"\\'")}')">🤖 AI Eco Analyze</button>
      </div>
    </div>
  `;
}

function buildExtBtns(query) {
  const enc = encodeURIComponent(query + " eco friendly");
  return `
    <a href="https://www.amazon.in/s?k=${enc}" target="_blank" class="ext-btn ext-amazon">Amazon.in</a>
    <a href="https://www.flipkart.com/search?q=${enc}" target="_blank" class="ext-btn ext-flipkart">Flipkart</a>
    <a href="https://www.meesho.com/search?q=${encodeURIComponent(query)}" target="_blank" class="ext-btn ext-meesho">Meesho</a>
    <a href="https://www.nykaa.com/search/result/?q=${encodeURIComponent(query)}" target="_blank" class="ext-btn ext-nykaa">Nykaa</a>
  `;
}

// ── Inline Eco Analyze ────────────────────────────────────────
async function analyzeCard(idx, name, brand) {
  const container = document.getElementById(`sra-${idx}`);
  if (!container) return;

  if (container.classList.contains("open")) {
    container.classList.remove("open");
    return;
  }

  container.classList.add("open");
  container.innerHTML = `<div style="font-style:italic;color:var(--text-soft);font-size:0.8rem;padding:0.5rem;">🤖 Analyzing eco impact…</div>`;

  try {
    const res = await fetch(`${API_BASE}/search/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, brand }),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();

    const gc = {"A+":"#00c853",A:"#43a047",B:"#8bc34a",C:"#ffc107",D:"#ff7043",F:"#f44336"};
    const color = gc[data.grade] || "#888";
    const fc = v => v>=8?"#4a8c5c":v>=6?"#8bc34a":v>=4?"#ffc107":"#f44336";
    const f = data.factors || {};

    container.innerHTML = `
      <div class="sra-grade-row">
        <div class="sra-badge" style="border-color:${color};color:${color};">
          <span>${data.ecoScore}</span><span style="font-size:0.55rem;">/10</span>
        </div>
        <div>
          <div style="font-weight:700;color:${color};font-size:0.9rem;">
            Grade ${data.grade} — ${data.ecoScore>=8?"Excellent 🌟":data.ecoScore>=6?"Good ✅":data.ecoScore>=4?"Average 🟡":"Poor ⚠️"}
          </div>
          <div style="font-size:0.75rem;color:var(--text-soft);">${data.summary||""}</div>
        </div>
      </div>
      <div class="sra-factors">
        ${Object.entries(f).map(([k,v])=>`
          <div class="sra-factor">
            ${k.replace(/([A-Z])/g,' $1').trim()}: <strong>${v}/10</strong>
            <div class="sra-bar"><div class="sra-fill" style="width:${v*10}%;background:${fc(v)};"></div></div>
          </div>`).join("")}
      </div>
      ${(data.positives||[]).length?`<div style="font-size:0.75rem;color:#2d5a3d;margin-top:0.3rem;">✅ ${data.positives.slice(0,2).join(" · ")}</div>`:""}
      ${(data.concerns||[]).length?`<div style="font-size:0.75rem;color:#c62828;margin-top:0.2rem;">⚠️ ${data.concerns[0]}</div>`:""}
      ${data.alternatives?.length?`<div style="font-size:0.75rem;color:var(--text-mid);margin-top:0.3rem;">🌱 <strong>Greener:</strong> ${data.alternatives.slice(0,2).map(a=>a.name).join(", ")}</div>`:""}
      ${data.tip?`<div class="sra-tip">💡 ${data.tip}</div>`:""}
    `;
    addScore(3);
  } catch {
    container.innerHTML = `<div style="color:#e53935;font-size:0.78rem;padding:0.5rem;">⚠️ Analysis failed. <button onclick="analyzeCard(${idx},'${name}','${brand}')" style="color:var(--green-mid);background:none;border:none;cursor:pointer;text-decoration:underline;">Retry</button></div>`;
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

// ── Analyzer Tab ──────────────────────────────────────────────
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

// ── Impact Calculator ─────────────────────────────────────────
function adjust(key, delta) {
  counters[key] = Math.max(0,(counters[key]||0)+delta);
  document.getElementById(`${key}-val`).textContent = counters[key];
}

async function calculateImpact() {
  const total = Object.values(counters).reduce((a,b)=>a+b,0);
  if (!total) { alert("Adjust at least one counter first."); return; }
  const params = new URLSearchParams({
    plasticBottles:counters.bottles, plasticBags:counters.bags,
    disposableCups:counters.cups, paperTowels:counters.towels,
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
      </div>
      <div class="impact-message">${data.message}</div>`;
    addScore(10);
    r.scrollIntoView({behavior:"smooth"});
  } catch { alert("Failed to calculate. Please try again."); }
}

function addScore(pts) {
  sessionScore += pts;
  document.getElementById("sessionScore").textContent = `${sessionScore} pts`;
}

// ── Init ──────────────────────────────────────────────────────
initShop();
document.getElementById("tab-shop").classList.remove("hidden");
document.getElementById("products-section").classList.remove("hidden");
