/* ═══════════════════════════════════════════════════════════════════════
   CineMatch — app.js  |  Clean build v4
   ═══════════════════════════════════════════════════════════════════════ */

const API  = "https://eco-cart-frontend.onrender.com/api";
const TMDB_KEY = "7558a8491c52de18243929b8e827d3f3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

// ── Session ───────────────────────────────────────────────────────────────
const SID_KEY = "cinematch_sid";
function getSid() {
  let id = localStorage.getItem(SID_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(SID_KEY, id); }
  return id;
}

// ── State ─────────────────────────────────────────────────────────────────
const S = {
  sid:      getSid(),
  step:     "choose_type",
  ct:       null,          // "movie" | "tv"
  mood:     "",
  surprise: false,
  langs:    [],
  results:  [],
  inter:    {},            // row_idx → "like"|"dislike"
  profile: {
    is_cold_start: true, top_genres: [], genre_scores: {},
    stats: { seen:0, liked:0, disliked:0, interactions:0 }
  },
};

// ── Moods ─────────────────────────────────────────────────────────────────
const MOODS = [
  {text:"Happy",        emoji:"😄", theme:"mood-happy"},
  {text:"Sad",          emoji:"😢", theme:"mood-sad"},
  {text:"Thrilling",    emoji:"😱", theme:"mood-thrilling"},
  {text:"Chill",        emoji:"😌", theme:"mood-chill"},
  {text:"Romantic",     emoji:"💘", theme:"mood-romantic"},
  {text:"Mind-bending", emoji:"🧠", theme:"mood-mindbending"},
  {text:"Dark",         emoji:"🌙", theme:"mood-dark"},
  {text:"Inspiring",    emoji:"🌟", theme:"mood-inspiring"},
  {text:"Treasure Hunt",emoji:"🗺️", theme:"mood-treasure"},
  {text:"Anime",        emoji:"🎌", theme:"mood-anime"},
  {text:"Adventurous",  emoji:"⚔️", theme:"mood-adventurous"},
  {text:"Mysterious",   emoji:"🔍", theme:"mood-mysterious"},
  {text:"Horror",       emoji:"😨", theme:"mood-horror"},
  {text:"Sci-fi",       emoji:"🚀", theme:"mood-scifi"},
  {text:"Fantasy",      emoji:"🧙", theme:"mood-fantasy"},
  {text:"Drama",        emoji:"🎭", theme:"mood-drama"},
  {text:"Crime",        emoji:"🕵️", theme:"mood-crime"},
  {text:"Documentary",  emoji:"📚", theme:"mood-documentary"},
  {text:"Family",       emoji:"👨‍👩‍👧", theme:"mood-family"},
  {text:"Action",       emoji:"🎬", theme:"mood-action"},
  {text:"Romance",      emoji:"🌸", theme:"mood-romance"},
  {text:"Musical",      emoji:"🎵", theme:"mood-musical"},
];

// ── Helpers ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function trunc(str, n) {
  const d = document.createElement("div");
  d.innerHTML = str || "";
  const t = d.textContent || "";
  return t.length > n ? t.slice(0, n) + "…" : t;
}

function setTheme(t) { document.body.className = t || ""; }

function toast(msg, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type==="success"?"✓":type==="error"?"✕":"✦"}</span>${msg}`;
  $("toast-container").appendChild(el);
  setTimeout(() => { el.classList.add("fade-out"); setTimeout(() => el.remove(), 350); }, 2800);
}

// ── Navigation ────────────────────────────────────────────────────────────
function goTo(step) {
  S.step = step;
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const pg = $(`page-${step}`);
  if (pg) pg.classList.add("active");
  renderStepBar();
  window.scrollTo({ top:0, behavior:"instant" });
}

function renderStepBar() {
  const steps = [
    {key:"choose_type", num:"1", label:"Content"},
    {key:"choose_mood", num:"2", label:"Mood"},
    {key:"results",     num:"3", label:"Results"},
  ];
  const cur = steps.findIndex(s => s.key === S.step);
  $("step-bar").innerHTML = steps.map((s,i) => {
    const done=i<cur, active=i===cur, cc=done?"done":active?"active":"";
    const conn = i<steps.length-1
      ? `<div class="step-connector ${done?"done":""}"></div>` : "";
    return `<div class="step-item">
      <div class="step-circle ${cc}">${done?"✓":s.num}</div>
      <div class="step-label ${cc}">${s.label}</div>
    </div>${conn}`;
  }).join("");
}

// ── Sidebar ───────────────────────────────────────────────────────────────
function renderSidebar() {
  const {profile, ct} = S;

  $("sidebar-content-type").innerHTML = ct
    ? `<span class="stat-chip">${ct==="movie"?"🎬 Movies":"📺 Web Series"}</span>` : "";

  const lbl = $("profile-type-label");
  const nm  = $("profile-type-name");
  if (lbl) { lbl.style.display = ct?"block":"none"; if(nm) nm.textContent = ct==="movie"?"🎬 Movies":"📺 Web Series"; }

  $("stat-seen").textContent     = profile.stats?.seen     || 0;
  $("stat-liked").textContent    = profile.stats?.liked    || 0;
  $("stat-disliked").textContent = profile.stats?.disliked || 0;

  const el  = $("taste-profile");
  const cnt = profile.stats?.interactions || 0;

  if (profile.is_cold_start) {
    const rem = Math.max(0, 5 - cnt);
    el.innerHTML = `
      <div class="cold-start-box">
        <strong>⭐ Rate ${rem} more title${rem!==1?"s":""}</strong>
        to unlock personalised ${ct==="tv"?"TV":"movie"} picks
      </div>`;
  } else {
    const genres = profile.top_genres  || [];
    const scores = profile.genre_scores || {};
    const allPos = Object.values(scores).filter(v => v > 0);
    const maxS   = allPos.length ? Math.max(...allPos) : 1;

    el.innerHTML = !genres.length
      ? `<div class="cold-start-box"><strong>Keep rating!</strong> Building your profile…</div>`
      : genres.map(g => {
          const pct   = Math.round(((scores[g]||0)/maxS)*100);
          const stars = "⭐".repeat(Math.max(1, Math.round((pct/100)*5)));
          return `
            <div class="genre-bar-item">
              <div class="genre-bar-label">
                <span>${g.charAt(0).toUpperCase()+g.slice(1)}</span>
                <span style="color:var(--accent);font-size:.75rem">${stars}</span>
              </div>
              <div class="genre-bar-track">
                <div class="genre-bar-fill" style="width:${pct}%"></div>
              </div>
            </div>`;
        }).join("");
  }
}

// ── TMDB Poster ───────────────────────────────────────────────────────────
async function fetchPoster(title, ct) {
  try {
    const type = ct==="tv" ? "tv" : "movie";
    const res  = await fetch(
      `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}`
    );
    const data = await res.json();
    const path = data.results?.[0]?.poster_path;
    return path ? TMDB_IMG + path : null;
  } catch { return null; }
}

// ── Language Filter ───────────────────────────────────────────────────────
async function loadLanguages(ct) {
  try {
    const res  = await fetch(`${API}/languages?content_type=${ct}`);
    const data = await res.json();
    const dd   = $("language-dropdown");
    dd.innerHTML = `<option value="">Select a language…</option>`;
    (data.languages||[]).forEach(l => {
      const o = document.createElement("option");
      o.value = l.code; o.textContent = `${l.name} (${l.code})`;
      dd.appendChild(o);
    });
  } catch(e) { console.error(e); }
}

function renderLangChips() {
  const box     = $("language-chips");
  const anyChip = $("lang-any-chip");
  box.querySelectorAll(".lang-chip").forEach(c => c.remove());
  if (!S.langs.length) { anyChip.style.display="inline-flex"; return; }
  anyChip.style.display = "none";
  S.langs.forEach(code => {
    const chip = document.createElement("span");
    chip.className = "lang-chip"; chip.dataset.code = code;
    chip.innerHTML = `${code} <span class="lang-chip-remove">✕</span>`;
    chip.addEventListener("click", () => {
      S.langs = S.langs.filter(l => l !== code); renderLangChips();
    });
    box.appendChild(chip);
  });
}

// ── Page: Choose Type ─────────────────────────────────────────────────────
// Listener on the PAGE element — cannot fire from results page (sibling)
function initChooseType() {
  $("page-choose_type").addEventListener("click", e => {
    const card = e.target.closest("[data-type]");
    if (!card) return;
    const type = card.dataset.type;
    if (type !== "movie" && type !== "tv") return;
    S.ct = type; S.langs = [];
    $("mood-heading").textContent = type==="movie"
      ? "🎬 Movie — What's your mood?"
      : "📺 Web Series — What's your mood?";
    goTo("choose_mood");
    renderSidebar();
    loadLanguages(type);
    renderLangChips();
  });
}

// ── Page: Choose Mood ─────────────────────────────────────────────────────
function initChooseMood() {
  const grid = $("mood-grid");
  grid.innerHTML = MOODS.map(m => `
    <button type="button" class="mood-btn" data-text="${m.text}" data-theme="${m.theme}">
      <span class="mood-emoji">${m.emoji}</span>
      <span>${m.text}</span>
    </button>`).join("");

  grid.addEventListener("click", e => {
    const btn = e.target.closest(".mood-btn"); if (!btn) return;
    document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    S.mood = btn.dataset.text;
    setTheme(btn.dataset.theme);
    $("mood-text-input").value = "";
    $("btn-find").disabled = false;
  });

  $("mood-text-input").addEventListener("input", e => {
    const v = e.target.value.trim();
    if (v) {
      document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("selected"));
      S.mood = v; setTheme("");
    }
    $("btn-find").disabled = !v && !S.mood;
  });

  $("btn-find").addEventListener("click", () => {
    S.mood = $("mood-text-input").value.trim() || S.mood;
    S.surprise = false;
    if (!S.mood) return;
    fetchRecs();
  });

  $("btn-surprise").addEventListener("click", () => {
    S.mood = ""; S.surprise = true;
    setTheme("");
    document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("selected"));
    fetchRecs();
  });

  $("btn-back-mood").addEventListener("click", () => { setTheme(""); goTo("choose_type"); });

  $("language-dropdown").addEventListener("change", e => {
    const v = e.target.value; if (!v) return;
    if (!S.langs.includes(v)) { S.langs.push(v); renderLangChips(); }
    e.target.value = "";
  });

  $("lang-any-chip").addEventListener("click", () => { S.langs = []; renderLangChips(); });
}

// ── Page: Results ─────────────────────────────────────────────────────────
function initResultsPage() {
  // Capture phase — fires BEFORE any bubble, impossible to reach choose_type
  $("results-list").addEventListener("click", e => {
    const like    = e.target.closest(".like-btn");
    const dislike = e.target.closest(".dislike-btn");
    if (!like && !dislike) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (like)    handleInter(like,    "like");
    if (dislike) handleInter(dislike, "dislike");
  }, true);

  $("btn-refresh").addEventListener("click", () => { S.inter = {}; fetchRecs(); });

  $("btn-change-mood").addEventListener("click", () => {
    S.inter = {}; S.mood = "";
    $("mood-text-input").value = "";
    $("btn-find").disabled = true;
    document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("selected"));
    goTo("choose_mood");
  });

  $("btn-start-over").addEventListener("click", async () => {
    try { await fetch(`${API}/reset?session_id=${S.sid}`, {method:"POST"}); } catch {}
    localStorage.removeItem(SID_KEY);
    const newSid = getSid();
    Object.assign(S, {
      sid:newSid, step:"choose_type", ct:null, mood:"", surprise:false,
      langs:[], results:[], inter:{},
      profile:{is_cold_start:true,top_genres:[],genre_scores:{},
               stats:{seen:0,liked:0,disliked:0,interactions:0}},
    });
    $("mood-text-input").value = "";
    $("btn-find").disabled = true;
    document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("selected"));
    renderLangChips(); setTheme(""); renderSidebar(); goTo("choose_type");
  });
}

// ── Fetch Recommendations ─────────────────────────────────────────────────
async function fetchRecs() {
  goTo("results");
  $("loading-screen").classList.add("active");
  $("results-content").style.display = "none";

  try {
    const res = await fetch(`${API}/recommend`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        session_id:   S.sid,
        content_type: S.ct,
        mood_text:    S.mood,
        surprise_me:  S.surprise,
        top_n:        10,
        languages:    S.langs.length ? S.langs : null,
      }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();

    S.results = data.results || [];
    S.profile = {
      is_cold_start: data.is_cold_start,
      top_genres:    data.top_genres   || [],
      genre_scores:  data.genre_scores || {},
      stats:         data.stats        || S.profile.stats,
    };

    renderResults();
    renderSidebar();
  } catch(err) {
    console.error(err);
    $("loading-screen").classList.remove("active");
    $("results-content").style.display = "block";
    $("results-list").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Could not reach the server</div>
        <div class="empty-sub">
          Make sure the backend is running:<br>
          <code>uvicorn main:app --reload --reload-exclude "data/*"</code>
        </div>
      </div>`;
  }
}

// ── Render Results ────────────────────────────────────────────────────────
function renderResults() {
  $("loading-screen").classList.remove("active");
  $("results-content").style.display = "block";

  $("result-banner-title").textContent = S.surprise
    ? "Surprise picks for you 🎲"
    : `Best matches for "${S.mood}"`;
  $("result-badge").textContent = S.ct==="movie" ? "🎬 Movies" : "📺 Web Series";

  const tag = $("personalised-tag");
  if (!S.profile.is_cold_start && S.profile.top_genres?.length) {
    tag.textContent = `🎯 Personalised — ${S.profile.top_genres.join(", ")}`;
    tag.style.display = "inline-flex";
  } else { tag.style.display = "none"; }

  const list = $("results-list");
  if (!S.results.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎬</div>
        <div class="empty-title">No results found</div>
        <div class="empty-sub">Try a different mood or use Surprise Me!</div>
      </div>`;
    return;
  }

  list.innerHTML = S.results.map((item, rank) => buildCard(item, rank+1)).join("");

  // Fetch posters in background if backend didn't provide them
  S.results.forEach(async (item, i) => {
    // Use poster_url from backend (TMDB path stored in SQLite)
    // If not available, fetch from TMDB directly
    if (!item.poster_url) {
      const url = await fetchPoster(item.title, S.ct);
      if (url) {
        const el = list.querySelector(`.movie-poster[data-rank="${i}"]`);
        if (el) el.innerHTML = `<img src="${url}" alt="${item.title}" loading="lazy">`;
      }
    }
  });
}

function buildCard(item, rank) {
  const genres = (item.genre||"").split(",").filter(Boolean)
    .map(g=>`<span class="genre-pill">${g.trim()}</span>`).join("");
  const meta = [
    item.language    ? `<span><b>Lang</b> ${item.language}</span>` : "",
    item.release_date ? `<span><b>Year</b> ${String(item.release_date).slice(0,4)}</span>` : "",
  ].filter(Boolean).join("");
  const rating = item.rating
    ? `<div class="movie-rating"><span class="rating-star">★</span><span class="rating-val">${item.rating.toFixed(1)}</span></div>` : "";
  const poster = item.poster_url
    ? `<img src="${item.poster_url}" alt="${item.title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=poster-placeholder><span class=poster-placeholder-icon>🎬</span></div>'">`
    : `<div class="poster-placeholder"><span class="poster-placeholder-icon">🎬</span></div>`;
  const inter = S.inter[item.row_idx];

  return `
    <div class="movie-card" style="animation-delay:${(rank-1)*0.05}s">
      <div class="movie-poster" data-rank="${rank-1}">${poster}</div>
      <div class="movie-card-body">
        <div class="movie-card-top">
          <div class="movie-rank">${rank}</div>
          <div class="movie-info">
            <div class="movie-title">${item.title}</div>
            <div class="genre-pills">${genres}</div>
            ${meta?`<div class="movie-meta">${meta}</div>`:""}
          </div>
          ${rating}
        </div>
        <div class="movie-desc">${trunc(item.description, 220)}</div>
        <div class="card-actions">
          <button type="button" class="like-btn ${inter==="like"?"active":""}"
            data-idx="${item.row_idx}"
            data-genres='${JSON.stringify(item.genre_list||[])}'>
            👍 Like
          </button>
          <button type="button" class="dislike-btn ${inter==="dislike"?"active":""}"
            data-idx="${item.row_idx}"
            data-genres='${JSON.stringify(item.genre_list||[])}'>
            👎 Pass
          </button>
        </div>
      </div>
    </div>`;
}

// ── Interaction ───────────────────────────────────────────────────────────
async function handleInter(btn, type) {
  const rowIdx = parseInt(btn.dataset.idx);
  const genres = JSON.parse(btn.dataset.genres || "[]");
  const liked  = type === "like";

  btn.closest(".movie-card")
     .querySelectorAll(".like-btn,.dislike-btn")
     .forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  S.inter[rowIdx] = type;
  toast(liked ? "Liked! Improving your picks…" : "Noted — tuning your taste profile.",
        liked ? "success" : "info");

  try {
    const res = await fetch(`${API}/interact`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        session_id:   S.sid,
        content_type: S.ct,
        row_idx:      rowIdx,
        genre_list:   genres,
        liked,
      }),
    });
    const data = await res.json();
    S.profile = {
      is_cold_start: data.is_cold_start,
      top_genres:    data.top_genres   || [],
      genre_scores:  data.genre_scores || {},
      stats:         data.stats        || S.profile.stats,
    };
    renderSidebar();
  } catch(err) { console.error(err); }
}

// ── Init ──────────────────────────────────────────────────────────────────
async function init() {
  $("greeting-text").textContent = greeting() + "!";
  goTo("choose_type");

  try {
    const res  = await fetch(`${API}/profile/${S.sid}?content_type=movie`);
    const data = await res.json();
    if ((data.stats?.interactions||0) > 0) {
      S.profile = {
        is_cold_start: data.is_cold_start,
        top_genres:    data.top_genres   || [],
        genre_scores:  data.genre_scores || {},
        stats:         data.stats,
      };
    }
  } catch {}

  renderSidebar();
  initChooseType();
  initChooseMood();
  initResultsPage();
}

document.addEventListener("DOMContentLoaded", init);
