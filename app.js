const API_BASE = "https://eco-cart-frontend.onrender.com/api";
let sessionScore = 0;
let chatHistory = [];
let allProducts = [];
let searchTimeout = null;
const counters = { bottles: 0, bags: 0, cups: 0, towels: 0 };

// ── Styles ────────────────────────────────────────────────────
const style = document.createElement("style");
style.textContent = `
  .buy-btn {
    display:inline-flex;align-items:center;justify-content:center;
    gap:0.4rem;padding:0.55rem 1rem;background:var(--green-mid);color:white;
    border-radius:50px;font-size:0.82rem;font-weight:600;text-decoration:none;
    transition:0.3s ease;border:none;cursor:pointer;
  }
  .buy-btn:hover{background:var(--green-deep);transform:translateY(-1px);}
  .analyze-btn{
    padding:0.55rem 1rem;background:var(--green-ghost);color:var(--green-mid);
    border:1.5px solid var(--green-pale);border-radius:50px;font-size:0.82rem;
    font-weight:600;cursor:pointer;transition:0.3s ease;
  }
  .analyze-btn:hover{background:var(--green-pale);}

  /* Search Results Grid */
  #searchResultsSection {
    max-width:1200px;margin:0 auto;padding:0 2.5rem 2rem;position:relative;z-index:1;
  }
  .sr-header {
    display:flex;align-items:center;justify-content:space-between;
    margin-bottom:1.25rem;
  }
  .sr-title { font-family:'DM Serif Display',serif;color:var(--green-deep);font-size:1.5rem; }
  .sr-close {
    background:none;border:1px solid var(--border);border-radius:50px;
    padding:0.3rem 0.85rem;cursor:pointer;font-size:0.82rem;color:var(--text-soft);
    transition:0.2s;
  }
  .sr-close:hover{background:var(--green-ghost);color:var(--green-mid);}
  .sr-grid {
    display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem;
    margin-bottom:1.5rem;
  }
  .sr-card {
    background:white;border:1px solid var(--border);border-radius:var(--radius);
    overflow:hidden;box-shadow:var(--shadow);transition:0.3s;display:flex;flex-direction:column;
  }
  .sr-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);}
  .sr-img {
    width:100%;height:180px;object-fit:contain;padding:1rem;background:#f9f9f9;
  }
  .sr-img-placeholder {
    width:100%;height:180px;display:flex;align-items:center;justify-content:center;
    font-size:3.5rem;background:var(--green-ghost);
  }
  .sr-body{padding:1rem;flex:1;display:flex;flex-direction:column;}
  .sr-name{font-weight:600;font-size:0.9rem;color:var(--text-dark);margin-bottom:0.3rem;line-height:1.4;}
  .sr-brand{font-size:0.75rem;color:var(--text-soft);margin-bottom:0.4rem;}
  .sr-price{font-weight:700;font-size:1.1rem;color:var(--green-deep);margin-bottom:0.3rem;}
  .sr-rating{font-size:0.75rem;color:var(--amber);margin-bottom:0.75rem;}
  .sr-platform{font-size:0.68rem;color:var(--text-soft);margin-top:auto;padding-top:0.5rem;}
  .sr-actions{display:flex;gap:0.5rem;margin-top:0.75rem;}

  /* Inline analysis */
  .sr-analysis{
    background:var(--green-ghost);border-top:1px solid var(--green-pale);
    padding:1rem;font-size:0.8rem;display:none;
  }
  .sr-analysis.visible{display:block;}
  .sra-grade{display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;}
  .sra-badge{
    width:42px;height:42px;border-radius:50%;display:flex;flex-direction:column;
    align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;border:2px solid;
  }
  .sra-factors{display:grid;grid-template-columns:1fr 1fr;gap:0.35rem;margin:0.5rem 0;}
  .sra-factor{font-size:0.72rem;color:var(--text-mid);}
  .sra-bar{height:4px;background:#ddd;border-radius:99px;margin-top:2px;overflow:hidden;}
  .sra-fill{height:100%;border-radius:99px;}
  .sra-tip{font-size:0.72rem;color:var(--earth);background:var(--amber-light);padding:0.4rem;border-radius:6px;margin-top:0.4rem;}

  /* External links */
  .ext-links-row{
    display:flex;gap:0.75rem;flex-wrap:wrap;
    padding:1rem 0;border-top:1px solid var(--border);margin-top:0.5rem;
  }
  .ext-link{
    display:inline-flex;align-items:center;gap:0.35rem;padding:0.45rem 1rem;
    border-radius:50px;font-size:0.8rem;font-weight:600;text-decoration:none;transition:0.2s;
  }
  .ext-amazon{background:#ff9900;color:white;}
  .ext-flipkart{background:#2874f0;color:white;}
  .ext-meesho{background:#f43397;color:white;}
  .ext-nykaa{background:#fc2779;color:white;}
  .ext-indiamart{background:#27ae60;color:white;}

  .search-loading{text-align:center;padding:2rem;color:var(--text-soft);font-style:italic;}
  .no-api-note{
    background:var(--amber-light);border:1px solid var(--amber);border-radius:var(--radius);
    padding:1.25rem;margin-bottom:1.5rem;font-size:0.88rem;color:var(--earth);
  }
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
      `<p style="color:#888;grid-column:1/-1;text-align:center;padding:2rem;">⚠️ Could not load products. Refresh in 30s.</p>`;
  }
}

function populateCategories() {
  const cats = [...new Set(allProducts.map(p => p.category))];
  const sel = document.getElementById("categoryFilter");
  sel.innerHTML = `<option value="">All Categories</option>`;
  cats.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);
}

// ── SEARCH ────────────────────────────────────────────────────
function filterProducts() {
  clearTimeout(searchTimeout);
  const search = document.getElementById("searchInput").value.trim();
  const category = document.getElementById("categoryFilter").value;
  const minScore = parseInt(document.getElementById("ecoFilter").value) || 0;

  // Filter local products
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

  // Remove old search results
  document.getElementById("searchResultsSection")?.remove();

  if (search.length > 1) {
    searchTimeout = setTimeout(() => fetchAndShowProducts(search), 500);
  }

  renderProductGrid(filtered);
}

async function fetchAndShowProducts(query) {
  // Remove old section
  document.getElementById("searchResultsSection")?.remove();

  // Create results section
  const section = document.createElement("div");
  section.id = "searchResultsSection";
  section.innerHTML = `
    <div class="sr-header">
      <div class="sr-title">🔍 Results for "${query}"</div>
      <button class="sr-close" onclick="closeSearch()">✕ Close</button>
    </div>
    <div class="search-loading">🔄 Searching Indian eco-friendly stores…</div>
  `;

  // Insert before products section
  const productsSection = document.getElementById("products-section");
  productsSection.parentNode.insertBefore(section, productsSection);
  section.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.source === "amazon" && data.products?.length) {
      // Real Amazon products
      section.innerHTML = `
        <div class="sr-header">
          <div class="sr-title">🛒 ${data.products.length} products for "${query}"</div>
          <button class="sr-close" onclick="closeSearch()">✕ Close</button>
        </div>
        <div class="sr-grid">
          ${data.products.map(p => `
            <div class="sr-card" id="src-${p.id}">
              ${p.image
                ? `<img src="${p.image}" class="sr-img" alt="${p.name}" onerror="this.style.display='none'" />`
                : `<div class="sr-img-placeholder">🌿</div>`}
              <div class="sr-body">
                <div class="sr-name">${p.name}</div>
                <div class="sr-brand">${p.brand}</div>
                <div class="sr-price">${p.price}</div>
                ${p.rating ? `<div class="sr-rating">⭐ ${p.rating} (${p.reviews||0} reviews)</div>` : ""}
                <div class="sr-actions">
                  <a href="${p.buyLink}" target="_blank" rel="noopener noreferrer" class="buy-btn" style="flex:1;">🛒 Buy on Amazon.in</a>
                  <button class="analyze-btn" onclick="analyzeSearchCard('${p.id}','${p.name.replace(/'/g,"\\'")}','${(p.brand||"").replace(/'/g,"\\'")}')">🔍 Eco Analyze</button>
                </div>
                <div class="sr-platform">Available on Amazon.in</div>
              </div>
              <div class="sr-analysis" id="sra-${p.id}"></div>
            </div>
          `).join("")}
        </div>
        ${buildExtLinks(query)}
      `;
    } else {
      // No API — show external links only
      section.innerHTML = `
        <div class="sr-header">
          <div class="sr-title">🔍 Search "${query}" on Indian stores</div>
          <button class="sr-close" onclick="closeSearch()">✕ Close</button>
        </div>
        <div class="no-api-note">
          💡 <strong>Direct product results</strong> require a RapidAPI key (set <code>RAPIDAPI_KEY</code> on Render).
          Meanwhile, click below to search directly on Indian eco-friendly stores:
        </div>
        ${buildExtLinks(query)}
        <div style="margin-top:1.5rem;">
          <p style="font-size:0.88rem;color:var(--text-soft);margin-bottom:0.75rem;">Or let AI analyze the eco-impact of "${query}":</p>
          <button class="btn-primary" onclick="aiAnalyzeQuery('${query.replace(/'/g,"\\'")}')">🤖 AI Eco Analyze "${query}"</button>
        </div>
      `;
    }
  } catch {
    section.innerHTML = `
      <div class="sr-header">
        <div class="sr-title">🔍 "${query}"</div>
        <button class="sr-close" onclick="closeSearch()">✕ Close</button>
      </div>
      ${buildExtLinks(query)}
    `;
  }
}

function buildExtLinks(query) {
  const enc = encodeURIComponent(query + " eco friendly");
  return `
    <div class="ext-links-row">
      <span style="font-size:0.8rem;color:var(--text-soft);align-self:center;font-weight:600;">Shop directly:</span>
      <a href="https://www.amazon.in/s?k=${enc}" target="_blank" class="ext-link ext-amazon">🛒 Amazon.in</a>
      <a href="https://www.flipkart.com/search?q=${enc}" target="_blank" class="ext-link ext-flipkart">🛒 Flipkart</a>
      <a href="https://www.meesho.com/search?q=${encodeURIComponent(query+' eco')}" target="_blank" class="ext-link ext-meesho">🛒 Meesho</a>
      <a href="https://www.nykaa.com/search/result/?q=${encodeURIComponent(query)}" target="_blank" class="ext-link ext-nykaa">🛒 Nykaa</a>
      <a href="https://dir.indiamart.com/search.mp?ss=${encodeURIComponent(query+' eco friendly')}" target="_blank" class="ext-link ext-indiamart">🛒 IndiaMART</a>
    </div>
  `;
}

async function analyzeSearchCard(id, name, brand) {
  const container = document.getElementById(`sra-${id}`);
  if (!container) return;

  if (container.classList.contains("visible") && container.innerHTML) {
    container.classList.toggle("visible");
    return;
  }

  container.classList.add("visible");
  container.innerHTML = `<div style="font-style:italic;color:var(--text-soft);font-size:0.8rem;">🤖 Analyzing ${name}…</div>`;

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
      <div class="sra-grade">
        <div class="sra-badge" style="border-color:${color};color:${color};">
          <span>${data.ecoScore}</span><span style="font-size:0.55rem;">/10</span>
        </div>
        <div>
          <div style="font-weight:700;color:${color};">Grade ${data.grade}</div>
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
      ${data.tip?`<div class="sra-tip">💡 ${data.tip}</div>`:""}
    `;
    addScore(3);
  } catch {
    container.innerHTML = `<div style="color:#e53935;font-size:0.78rem;">⚠️ Analysis failed. <button onclick="analyzeSearchCard('${id}','${name}','${brand}')" style="color:var(--green-mid);background:none;border:none;cursor:pointer;text-decoration:underline;">Retry</button></div>`;
  }
}

function closeSearch() {
  document.getElementById("searchResultsSection")?.remove();
  document.getElementById("searchInput").value = "";
  renderProductGrid(allProducts);
}

function aiAnalyzeQuery(query) {
  closeSearch();
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
    grid.innerHTML = `<p style="color:#888;grid-column:1/-1;text-align:center;padding:2rem;">No products found.</p>`;
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
      <div style="font-size:0.68rem;color:var(--text-soft);text-align:center;margin-top:0.3rem;">on ${p.platform||"Amazon.in"}</div>
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
loadProducts();
document.getElementById("tab-shop").classList.remove("hidden");
document.getElementById("products-section").classList.remove("hidden");
