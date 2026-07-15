/* ============================================================
   FABLE — shared client logic
   Firebase Firestore (data) + ImgBB (images) · LocalStorage auth
   Masters & Slaves social clicker
   ============================================================ */

// ============================================================================
//
//  STEP 1 — FIREBASE CONFIGURATION (REQUIRED for feed / game economy)
//  ─────────────────────────────────────────────────────────────────
//  Without real keys, the app shows a setup banner and
//  realtime features (feed, games economy) stay offline.
//
//  HOW TO GET YOUR KEYS (Firebase Console):
//
//    1. Open https://console.firebase.google.com
//    2. Create a project (or select an existing one)
//    3. Click the gear ⚙ → Project settings
//    4. Under "Your apps", click the Web icon </>, register an app
//    5. Copy the firebaseConfig object values into the fields below
//
//  THEN ENABLE SERVICES:
//
//    • Build → Firestore Database → Create database
//        – Start in TEST MODE for local demos
//        – Choose any region
//
//  NOTE: Firebase Storage is NOT used (pricing limits).
//        Images are uploaded via the free ImgBB API instead.
//
//  PASTE VALUES HERE — replace every YOUR_* placeholder:
// ============================================================================
const firebaseConfig = {
  // From Project settings → General → Your apps → SDK setup
  apiKey: "AIzaSyBIYnZcGrIP8An9ZvnFDLnqvKXymDU_B3o",                         // e.g. "AIzaSy..."
  authDomain: "fable-sait.firebaseapp.com",  // e.g. "fable-app.firebaseapp.com"
  projectId: "fable-sait",                   // e.g. "fable-app"
  storageBucket: "fable-sait.firebasestorage.app",   // optional / unused (ImgBB for images)
  messagingSenderId: "779246204482",  // numeric string
  appId: "G-W82VCYCKD2",                           // e.g. "1:123:web:abc"
};

// ============================================================================
//  ImgBB — free image hosting (replaces Firebase Storage)
//  Get a key at https://api.imgbb.com/  (Account → API)
// ============================================================================
const IMGBB_API_KEY = "daa0c00d6ef8246d2d3ba58d19f83ce0";

// Optional: set to true only while debugging config
const FIREBASE_DEBUG = false;

// ============================================================================
//  Game economy constants — Masters & Slaves
// ============================================================================
const MS = {
  BASE_PRICE: 100,           // starting market price for new players
  PRICE_MULTIPLIER: 1.2,     // Price_new = Price_current × 1.20 after purchase
  INCOME_RATE_PER_HOUR: 0.05,// vassal generates 5% of their CURRENT price per hour
  BUYOUT_PENALTY: 1.1,       // self-buyout = price × 1.10
  FARM_CLICK_GOLD: 5,        // gold per farm click
  FETTER_MS: 5 * 60 * 1000,  // chain/fetter duration (5 min demo)
  INCOME_TICK_MS: 5000,      // client income accrual interval
  COLLECTION_PLAYERS: "players",
  COLLECTION_POSTS: "posts",
  COLLECTION_EVENTS: "gameEvents",
};

// ============================================================================
//  LocalStorage nickname auth (ultra-simple)
// ============================================================================
const NICK_KEY = "fable_nickname";

function getNickname() {
  try {
    return (localStorage.getItem(NICK_KEY) || "").trim();
  } catch {
    return "";
  }
}

function setNickname(name) {
  localStorage.setItem(NICK_KEY, name.trim());
}

function clearNickname() {
  localStorage.removeItem(NICK_KEY);
}

/**
 * Returns true when firebaseConfig has been filled with real project keys
 * (not the YOUR_* placeholders).
 */
function isConfigured() {
  const { apiKey, projectId, appId } = firebaseConfig;
  if (!apiKey || !projectId || !appId) return false;
  if (apiKey === "YOUR_API_KEY") return false;
  if (projectId === "YOUR_PROJECT_ID") return false;
  if (appId === "YOUR_APP_ID") return false;
  if (apiKey.startsWith("YOUR_")) return false;
  return true;
}

// ============================================================================
//  Navigation & UI helpers
// ============================================================================
function navigateTo(url) {
  const go = () => {
    window.location.href = url;
  };
  const page = document.querySelector(".page, .login-wrap");
  if (!page) {
    go();
    return;
  }
  if (document.startViewTransition) {
    document.startViewTransition(() => {
      page.classList.add("is-leaving");
      return new Promise((resolve) => {
        setTimeout(() => {
          go();
          resolve();
        }, 80);
      });
    });
  } else {
    page.classList.add("is-leaving");
    setTimeout(go, 280);
  }
}

function requireAuth() {
  const nick = getNickname();
  if (!nick) {
    window.location.replace("index.html");
    return null;
  }
  return nick;
}

function redirectIfAuthed() {
  if (getNickname()) {
    window.location.replace("feed.html");
  }
}

function toast(message, type = "ok") {
  let host = document.querySelector(".toast-host");
  if (!host) {
    host = document.createElement("div");
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = `toast${type === "error" ? " error" : ""}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function avatarLetter(name) {
  return (name || "?").trim().charAt(0).toUpperCase() || "?";
}

function formatTime(ts) {
  if (!ts) return "just now";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatGold(n) {
  const v = Math.floor(Number(n) || 0);
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e4) return (v / 1e3).toFixed(1) + "K";
  return String(v);
}

function heartSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.7-4.35-9.33-7.6C.8 11.2.9 7.9 3.2 5.9c2-1.75 4.9-1.4 6.6.5L12 8.6l2.2-2.2c1.7-1.9 4.6-2.25 6.6-.5 2.3 2 2.4 5.3.53 7.5C18.7 16.65 12 21 12 21z"/></svg>`;
}

function playerDocId(nickname) {
  // Firestore-safe id from nickname (deterministic)
  return "u_" + encodeURIComponent(nickname).replace(/%/g, "_");
}

// ============================================================================
//  Firebase bootstrap (Firestore only — images use ImgBB)
// ============================================================================
let db = null;
let firebaseReady = false;

/**
 * Initialize Firebase App + Firestore.
 * Requires firebase-app-compat.js + firebase-firestore-compat.js in the HTML
 * and a filled firebaseConfig. Images go through ImgBB, not Storage.
 */
async function initFirebase() {
  if (!isConfigured()) {
    console.warn(
      "[Fable] Firebase is not configured.\n" +
        "Open script.js → find firebaseConfig → paste keys from Firebase Console\n" +
        "(Project settings → Your apps → Web app)."
    );
    return false;
  }

  if (typeof firebase === "undefined") {
    console.error(
      "[Fable] Firebase SDK not loaded. Ensure firebase-app-compat.js and " +
        "firebase-firestore-compat.js are included in the HTML."
    );
    return false;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      if (FIREBASE_DEBUG) console.log("[Fable] Firebase app initialized", firebaseConfig.projectId);
    }
    db = firebase.firestore();
    firebaseReady = true;
    return true;
  } catch (err) {
    console.error("[Fable] Firebase init failed:", err);
    firebaseReady = false;
    return false;
  }
}

function showConfigBanner(container) {
  if (!container || isConfigured()) return;
  if (container.querySelector(".config-banner")) return;
  const banner = document.createElement("div");
  banner.className = "config-banner";
  banner.innerHTML = `
    <strong>Firebase is not configured yet</strong>
    <ol>
      <li>Open <code>script.js</code></li>
      <li>Find the <code>firebaseConfig</code> object near the top</li>
      <li>Replace every <code>YOUR_*</code> value with keys from
        <em>Firebase Console → ⚙ Project settings → Your apps → Web</em></li>
      <li>Enable <strong>Firestore</strong> (test mode is fine for demos).
        Images use free <strong>ImgBB</strong> — no Firebase Storage needed.</li>
      <li>Refresh this page</li>
    </ol>
  `;
  container.prepend(banner);
}

/**
 * Upload an image file to ImgBB and return the public display URL.
 * API docs: https://api.imgbb.com/
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      // strip data URL prefix → raw base64
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.readAsDataURL(file);
  });
}

async function uploadImageToImgBB(file) {
  if (!IMGBB_API_KEY || IMGBB_API_KEY.startsWith("YOUR_")) {
    throw new Error("ImgBB API key is missing. Set IMGBB_API_KEY in script.js");
  }
  if (!file) throw new Error("No image selected");

  // Soft size guard (~8MB) — ImgBB free tier is generous but keep UX snappy
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image is too large (max ~8MB)");
  }

  const base64 = await fileToBase64(file);
  const body = new FormData();
  body.append("key", IMGBB_API_KEY);
  body.append("image", base64);
  body.append("name", `fable_${Date.now()}`);

  const res = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success || !json?.data?.url) {
    const msg = json?.error?.message || `ImgBB upload failed (${res.status})`;
    throw new Error(msg);
  }

  // Prefer direct display URL; fall back to url
  return json.data.display_url || json.data.url;
}

function setLiveDot(online) {
  const live = document.getElementById("live-status");
  if (live) live.classList.toggle("offline", !online);
}

// ============================================================================
//  Ensure a player economy document exists (for Masters & Slaves + market)
// ============================================================================
async function ensurePlayerRecord(nickname) {
  if (!firebaseReady || !nickname) return null;
  const id = playerDocId(nickname);
  const ref = db.collection(MS.COLLECTION_PLAYERS).doc(id);
  try {
    const snap = await ref.get();
    if (!snap.exists) {
      const data = {
        nickname,
        gold: 50,
        price: MS.BASE_PRICE,
        ownerId: null,
        ownerName: null,
        vassals: [],
        fetteredUntil: 0,
        lastIncomeAt: Date.now(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      await ref.set(data);
      return { id, ...data };
    }
    // Keep nickname in sync
    const data = snap.data();
    if (data.nickname !== nickname) {
      await ref.update({ nickname, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      data.nickname = nickname;
    }
    return { id, ...data };
  } catch (err) {
    console.error("[Fable] ensurePlayerRecord:", err);
    return null;
  }
}

async function writeGameEvent(targetNickname, message, meta = {}) {
  if (!firebaseReady) return;
  try {
    await db.collection(MS.COLLECTION_EVENTS).add({
      targetNickname,
      message,
      meta,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      read: false,
    });
  } catch (err) {
    console.error("[Fable] writeGameEvent:", err);
  }
}

// ============================================================================
//  Bottom nav + create-post modal
// ============================================================================
function wireBottomNav(active) {
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    const target = btn.getAttribute("data-nav");
    if (target === active) btn.classList.add("active");

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (target === "create") {
        openCreateModal();
        return;
      }
      if (target === active) return;
      const map = {
        feed: "feed.html",
        profile: "profile.html",
        games: "games.html",
      };
      if (map[target]) navigateTo(map[target]);
    });
  });
}

function ensureModal() {
  if (document.getElementById("create-modal")) return;

  const overlay = document.createElement("div");
  overlay.id = "create-modal";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-sheet glass-strong" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h2 id="create-title">New Post</h2>
        <button type="button" class="modal-close" id="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="preview-box" id="preview-box">
        <div class="preview-placeholder" id="preview-placeholder">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          <p>Tap to upload a PNG photo</p>
        </div>
        <img id="preview-img" alt="Preview" hidden />
        <input type="file" id="post-image" accept="image/png,image/*" />
      </div>
      <div class="field">
        <label for="post-text">Caption</label>
        <textarea id="post-text" maxlength="500" placeholder="Share a legend…"></textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="modal-cancel">Cancel</button>
        <button type="button" class="btn btn-primary" id="modal-publish">Publish</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => closeCreateModal();
  overlay.querySelector("#modal-close").addEventListener("click", close);
  overlay.querySelector("#modal-cancel").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  const fileInput = overlay.querySelector("#post-image");
  const previewImg = overlay.querySelector("#preview-img");
  const placeholder = overlay.querySelector("#preview-placeholder");
  const box = overlay.querySelector("#preview-box");

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Please choose an image file (PNG preferred).", "error");
      fileInput.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    previewImg.src = url;
    previewImg.hidden = false;
    placeholder.hidden = true;
    box.classList.add("has-image");
  });

  overlay.querySelector("#modal-publish").addEventListener("click", () => {
    publishPost();
  });
}

function openCreateModal() {
  ensureModal();
  document.getElementById("create-modal").classList.add("open");
  document.body.style.overflow = "hidden";
  setTimeout(() => document.getElementById("post-text")?.focus(), 350);
}

function closeCreateModal() {
  const overlay = document.getElementById("create-modal");
  if (!overlay) return;
  overlay.classList.remove("open");
  document.body.style.overflow = "";
  setTimeout(() => {
    const fileInput = document.getElementById("post-image");
    const previewImg = document.getElementById("preview-img");
    const placeholder = document.getElementById("preview-placeholder");
    const box = document.getElementById("preview-box");
    const text = document.getElementById("post-text");
    if (fileInput) fileInput.value = "";
    if (text) text.value = "";
    if (previewImg) {
      previewImg.hidden = true;
      previewImg.removeAttribute("src");
    }
    if (placeholder) placeholder.hidden = false;
    if (box) box.classList.remove("has-image");
  }, 320);
}

async function publishPost() {
  const nick = getNickname();
  if (!nick) {
    toast("Please sign in first.", "error");
    return;
  }

  const textEl = document.getElementById("post-text");
  const fileInput = document.getElementById("post-image");
  const publishBtn = document.getElementById("modal-publish");
  const text = (textEl?.value || "").trim();
  const file = fileInput?.files?.[0];

  if (!text && !file) {
    toast("Add a caption or a photo.", "error");
    return;
  }
  if (!firebaseReady) {
    toast("Firebase is not configured. Open script.js and paste your keys.", "error");
    return;
  }

  publishBtn.disabled = true;
  publishBtn.textContent = file ? "Uploading image…" : "Publishing…";

  try {
    let imageUrl = "";

    // Images → free ImgBB API (not Firebase Storage)
    if (file) {
      imageUrl = await uploadImageToImgBB(file);
      publishBtn.textContent = "Publishing…";
    }

    await db.collection(MS.COLLECTION_POSTS).add({
      author: nick,
      text,
      imageUrl, // public ImgBB URL (or "")
      imageHost: imageUrl ? "imgbb" : "",
      likes: 0,
      likedBy: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    toast("Posted to the realm ✨");
    closeCreateModal();
  } catch (err) {
    console.error(err);
    toast(err.message || "Could not publish post.", "error");
  } finally {
    publishBtn.disabled = false;
    publishBtn.textContent = "Publish";
  }
}

// ============================================================================
//  Feed
// ============================================================================
function renderPostCard(id, data, currentUser) {
  const liked = Array.isArray(data.likedBy) && data.likedBy.includes(currentUser);
  const likes = data.likes || 0;
  const hasImage = Boolean(data.imageUrl);

  return `
    <article class="post-card glass" data-post-id="${escapeHtml(id)}">
      <div class="post-header">
        <div class="avatar" aria-hidden="true">${escapeHtml(avatarLetter(data.author))}</div>
        <div class="post-meta">
          <div class="post-author">${escapeHtml(data.author || "anon")}</div>
          <div class="post-time">${escapeHtml(formatTime(data.createdAt))}</div>
        </div>
      </div>
      ${
        hasImage
          ? `<div class="post-image-wrap"><img src="${escapeHtml(data.imageUrl)}" alt="Post by ${escapeHtml(
              data.author || ""
            )}" loading="lazy" /></div>`
          : ""
      }
      ${data.text ? `<div class="post-body">${escapeHtml(data.text)}</div>` : ""}
      <div class="post-actions">
        <button type="button" class="like-btn${liked ? " liked" : ""}" data-like="${escapeHtml(
          id
        )}" aria-pressed="${liked}">
          <span class="heart">${heartSvg()}</span>
          <span class="like-count">${likes}</span>
        </button>
      </div>
    </article>
  `;
}

function wireLikeButtons(root, currentUser) {
  root.querySelectorAll("[data-like]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!firebaseReady) {
        toast("Firebase is not configured.", "error");
        return;
      }
      const id = btn.getAttribute("data-like");
      const ref = db.collection(MS.COLLECTION_POSTS).doc(id);
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) return;
          const d = snap.data();
          const likedBy = Array.isArray(d.likedBy) ? [...d.likedBy] : [];
          const idx = likedBy.indexOf(currentUser);
          if (idx >= 0) likedBy.splice(idx, 1);
          else likedBy.push(currentUser);
          tx.update(ref, { likedBy, likes: likedBy.length });
        });
        btn.classList.add("liked");
        const heart = btn.querySelector(".heart");
        if (heart) {
          heart.style.animation = "none";
          void heart.offsetWidth;
          heart.style.animation = "";
        }
      } catch (err) {
        console.error(err);
        toast("Could not update like.", "error");
      }
    });
  });
}

function subscribeFeed(listEl, currentUser) {
  if (!firebaseReady) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="emoji">📜</div>
        <p>Connect Firebase to see the live feed.</p>
      </div>`;
    return () => {};
  }

  listEl.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Unrolling the chronicle…</p>
    </div>`;

  const q = db.collection(MS.COLLECTION_POSTS).orderBy("createdAt", "desc").limit(50);

  return q.onSnapshot(
    (snapshot) => {
      if (snapshot.empty) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="emoji">🏰</div>
            <p>No posts yet. Be the first legend in the feed.</p>
          </div>`;
        return;
      }
      const html = snapshot.docs
        .map((doc, i) => {
          const card = renderPostCard(doc.id, doc.data(), currentUser);
          return card.replace(
            'class="post-card',
            `style="animation-delay:${Math.min(i * 0.05, 0.4)}s" class="post-card`
          );
        })
        .join("");
      listEl.innerHTML = html;
      wireLikeButtons(listEl, currentUser);
    },
    (err) => {
      console.error(err);
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="emoji">⚠️</div>
          <p>Could not load feed. Check Firestore rules.</p>
        </div>`;
    }
  );
}

// ============================================================================
//  Profile
// ============================================================================
function subscribeProfile(gridEl, statsEl, currentUser) {
  if (!firebaseReady) {
    gridEl.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="emoji">📜</div>
        <p>Connect Firebase to load your posts.</p>
      </div>`;
    return () => {};
  }

  gridEl.innerHTML = `
    <div class="loading-state" style="grid-column:1/-1">
      <div class="spinner"></div>
      <p>Loading your legends…</p>
    </div>`;

  const q = db.collection(MS.COLLECTION_POSTS).where("author", "==", currentUser).limit(100);

  return q.onSnapshot(
    (snapshot) => {
      const docs = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || 0;
          const tb = b.createdAt?.toMillis?.() || 0;
          return tb - ta;
        });

      const totalLikes = docs.reduce((sum, d) => sum + (d.likes || 0), 0);
      if (statsEl) {
        statsEl.innerHTML = `
          <div class="stat">
            <div class="stat-value">${docs.length}</div>
            <div class="stat-label">Posts</div>
          </div>
          <div class="stat">
            <div class="stat-value">${totalLikes}</div>
            <div class="stat-label">Likes</div>
          </div>
        `;
      }

      if (!docs.length) {
        gridEl.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1">
            <div class="emoji">📸</div>
            <p>You haven’t posted yet. Tap + to create one.</p>
          </div>`;
        return;
      }

      gridEl.innerHTML = docs
        .map((d, i) => {
          const img = d.imageUrl
            ? `<img src="${escapeHtml(d.imageUrl)}" alt="" loading="lazy" />`
            : `<div style="display:grid;place-items:center;height:100%;padding:12px;font-size:0.8rem;color:var(--text-muted);text-align:center">${escapeHtml(
                (d.text || "").slice(0, 80)
              )}</div>`;
          return `
            <div class="grid-item" style="animation-delay:${Math.min(i * 0.04, 0.35)}s">
              ${img}
              <div class="grid-overlay">
                <span>${heartSvg().replace("viewBox", 'width="12" height="12" viewBox')}</span>
                ${d.likes || 0}
              </div>
            </div>`;
        })
        .join("");
    },
    (err) => {
      console.error(err);
      gridEl.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="emoji">⚠️</div>
          <p>Could not load profile posts.</p>
        </div>`;
    }
  );
}

function subscribeNotifications(listEl, currentUser) {
  if (!listEl) return () => {};
  if (!firebaseReady) {
    listEl.innerHTML = `<p class="muted" style="padding:8px 0">Events appear when Firebase is connected.</p>`;
    return () => {};
  }

  const q = db
    .collection(MS.COLLECTION_EVENTS)
    .where("targetNickname", "==", currentUser)
    .limit(30);

  return q.onSnapshot(
    (snapshot) => {
      const docs = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || 0;
          const tb = b.createdAt?.toMillis?.() || 0;
          return tb - ta;
        })
        .slice(0, 12);

      if (!docs.length) {
        listEl.innerHTML = `<p class="muted" style="padding:4px 0">No realm events yet.</p>`;
        return;
      }

      listEl.innerHTML = docs
        .map(
          (d, i) => `
        <div class="notif-item glass" style="animation-delay:${Math.min(i * 0.04, 0.3)}s">
          ${escapeHtml(d.message)}
          <span class="notif-time">${escapeHtml(formatTime(d.createdAt))}</span>
        </div>`
        )
        .join("");
    },
    (err) => {
      console.error(err);
      listEl.innerHTML = `<p class="muted">Could not load events.</p>`;
    }
  );
}

// ============================================================================
//  MASTERS & SLAVES — full game logic
// ============================================================================
const MastersSlaves = {
  me: null,
  unsubMe: null,
  unsubMarket: null,
  incomeTimer: null,
  currentNick: null,

  async start(nickname) {
    this.currentNick = nickname;
    this.stop();

    if (!firebaseReady) {
      this.renderOffline();
      return;
    }

    await ensurePlayerRecord(nickname);
    this.bindUi();

    const myId = playerDocId(nickname);
    this.unsubMe = db
      .collection(MS.COLLECTION_PLAYERS)
      .doc(myId)
      .onSnapshot(
        (snap) => {
          if (!snap.exists) return;
          this.me = { id: snap.id, ...snap.data() };
          this.renderHud();
          this.renderStatus();
          this.renderPlantation();
        },
        (err) => console.error(err)
      );

    this.unsubMarket = db.collection(MS.COLLECTION_PLAYERS).limit(80).onSnapshot(
      (snapshot) => {
        const players = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        this.renderMarket(players);
      },
      (err) => console.error(err)
    );

    // Passive income tick for owned vassals
    this.incomeTimer = setInterval(() => this.accrueIncome(), MS.INCOME_TICK_MS);
  },

  stop() {
    if (this.unsubMe) this.unsubMe();
    if (this.unsubMarket) this.unsubMarket();
    if (this.incomeTimer) clearInterval(this.incomeTimer);
    this.unsubMe = this.unsubMarket = this.incomeTimer = null;
  },

  bindUi() {
    // Sub-tabs
    document.querySelectorAll(".ms-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".ms-tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".ms-tab-panel").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        const panel = document.getElementById(tab.dataset.panel);
        if (panel) panel.classList.add("active");
      });
    });

    const farm = document.getElementById("farm-btn");
    if (farm && !farm.dataset.bound) {
      farm.dataset.bound = "1";
      farm.addEventListener("click", (e) => this.farmClick(e));
    }

    const buyout = document.getElementById("self-buyout-btn");
    if (buyout && !buyout.dataset.bound) {
      buyout.dataset.bound = "1";
      buyout.addEventListener("click", () => this.selfBuyout());
    }
  },

  renderOffline() {
    const root = document.getElementById("ms-root");
    if (!root) return;
    root.innerHTML = `
      <div class="empty-state glass">
        <div class="emoji">⚔️</div>
        <p>Masters &amp; Slaves needs Firebase.<br/>Paste your keys in <code>script.js</code>.</p>
      </div>`;
  },

  renderHud() {
    if (!this.me) return;
    const goldEl = document.getElementById("ms-gold");
    const priceEl = document.getElementById("ms-price");
    const incomeEl = document.getElementById("ms-income");
    if (goldEl) goldEl.textContent = formatGold(this.me.gold);
    if (priceEl) priceEl.textContent = formatGold(this.me.price);
    if (incomeEl) {
      const hourly = this.estimateHourlyIncome();
      incomeEl.textContent = formatGold(hourly) + "/h";
    }
  },

  estimateHourlyIncome() {
    // Approximate: sum of 5% of each vassal's price (we re-fetch in plantation)
    // HUD uses cached vassal prices from last market render if available
    const list = this._lastVassalPrices || [];
    return list.reduce((s, p) => s + p * MS.INCOME_RATE_PER_HOUR, 0);
  },

  renderStatus() {
    const el = document.getElementById("ms-status");
    const buyoutBtn = document.getElementById("self-buyout-btn");
    if (!el || !this.me) return;

    const owned = Boolean(this.me.ownerName);
    const fettered = (this.me.fetteredUntil || 0) > Date.now();

    el.innerHTML = owned
      ? `<span class="badge badge-owned">Owned</span>
         <div>You serve <strong>${escapeHtml(this.me.ownerName)}</strong>.
         Your market price is <span class="price">${formatGold(this.me.price)}</span> gold.
         ${fettered ? "<br/>⛓ You are currently <strong>fettered</strong> (cannot be bought)." : ""}</div>`
      : `<span class="badge badge-free">Free</span>
         <div>You walk free in the realm. Market value:
         <span class="price">${formatGold(this.me.price)}</span> gold.
         ${fettered ? "<br/>⛓ Fettered by your master." : ""}</div>`;

    if (buyoutBtn) {
      buyoutBtn.style.display = owned ? "inline-flex" : "none";
      const cost = Math.ceil((this.me.price || MS.BASE_PRICE) * MS.BUYOUT_PENALTY);
      buyoutBtn.textContent = `Buy freedom (${formatGold(cost)}g)`;
    }
  },

  async farmClick(e) {
    if (!firebaseReady || !this.me) {
      toast("Connect Firebase to farm gold.", "error");
      return;
    }
    const btn = document.getElementById("farm-btn");
    btn?.classList.add("pulse");
    setTimeout(() => btn?.classList.remove("pulse"), 120);

    // Floating +gold
    const float = document.createElement("div");
    float.className = "farm-float";
    float.textContent = `+${MS.FARM_CLICK_GOLD}`;
    float.style.left = (e.clientX || window.innerWidth / 2) + "px";
    float.style.top = (e.clientY || window.innerHeight / 2) + "px";
    document.body.appendChild(float);
    setTimeout(() => float.remove(), 900);

    try {
      const ref = db.collection(MS.COLLECTION_PLAYERS).doc(this.me.id);
      await ref.update({
        gold: firebase.firestore.FieldValue.increment(MS.FARM_CLICK_GOLD),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      toast("Could not farm gold.", "error");
    }
  },

  renderMarket(players) {
    const list = document.getElementById("ms-market-list");
    if (!list || !this.me) return;

    const others = players
      .filter((p) => p.nickname && p.nickname !== this.currentNick)
      .sort((a, b) => (a.price || 0) - (b.price || 0));

    if (!others.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="emoji">🗡️</div>
          <p>No other adventurers yet. Invite friends to enter the realm.</p>
        </div>`;
      return;
    }

    list.innerHTML = others
      .map((p, i) => {
        const fettered = (p.fetteredUntil || 0) > Date.now();
        const isMine = p.ownerName === this.currentNick;
        const status = p.ownerName
          ? isMine
            ? "Your vassal"
            : `Owned by ${p.ownerName}`
          : "Free";
        const disabled = fettered || isMine || p.ownerName === this.currentNick;
        return `
          <div class="player-row glass" style="animation-delay:${Math.min(i * 0.03, 0.3)}s">
            <div class="avatar">${escapeHtml(avatarLetter(p.nickname))}</div>
            <div class="player-info">
              <div class="name">${escapeHtml(p.nickname)}</div>
              <div class="meta">${escapeHtml(status)}${fettered ? " · ⛓ Fettered" : ""}</div>
              <div class="meta">Price: <span class="price">${formatGold(p.price || MS.BASE_PRICE)}g</span></div>
            </div>
            <div class="player-actions">
              <button type="button" class="btn btn-amber btn-sm" data-buy="${escapeHtml(p.id)}"
                ${disabled ? "disabled" : ""}>
                ${isMine ? "Yours" : fettered ? "Locked" : "Buy"}
              </button>
            </div>
          </div>`;
      })
      .join("");

    list.querySelectorAll("[data-buy]").forEach((btn) => {
      btn.addEventListener("click", () => this.buyPlayer(btn.getAttribute("data-buy")));
    });
  },

  async renderPlantation() {
    const list = document.getElementById("ms-plantation-list");
    if (!list || !this.me) return;

    const vassalIds = Array.isArray(this.me.vassals) ? this.me.vassals : [];
    if (!vassalIds.length) {
      this._lastVassalPrices = [];
      list.innerHTML = `
        <div class="empty-state">
          <div class="emoji">🏰</div>
          <p>Your castle is empty. Buy freemen from the Market.</p>
        </div>`;
      this.renderHud();
      return;
    }

    try {
      // Batch get vassals (chunk if needed)
      const chunks = [];
      for (let i = 0; i < vassalIds.length; i += 10) {
        chunks.push(vassalIds.slice(i, i + 10));
      }
      const vassals = [];
      for (const chunk of chunks) {
        const snaps = await Promise.all(
          chunk.map((id) => db.collection(MS.COLLECTION_PLAYERS).doc(id).get())
        );
        snaps.forEach((s) => {
          if (s.exists) vassals.push({ id: s.id, ...s.data() });
        });
      }

      this._lastVassalPrices = vassals.map((v) => v.price || MS.BASE_PRICE);
      this.renderHud();

      const hourly = this._lastVassalPrices.reduce(
        (s, p) => s + p * MS.INCOME_RATE_PER_HOUR,
        0
      );

      list.innerHTML =
        `<div class="income-bar">Passive income ≈ <strong>${formatGold(hourly)} gold/hour</strong> (5% of each vassal’s price)</div>` +
        vassals
          .map((v, i) => {
            const fettered = (v.fetteredUntil || 0) > Date.now();
            const remain = fettered
              ? Math.ceil(((v.fetteredUntil || 0) - Date.now()) / 60000)
              : 0;
            return `
              <div class="player-row glass" style="animation-delay:${Math.min(i * 0.03, 0.3)}s">
                <div class="avatar">${escapeHtml(avatarLetter(v.nickname))}</div>
                <div class="player-info">
                  <div class="name">${escapeHtml(v.nickname)}</div>
                  <div class="meta">Worth <span class="price">${formatGold(v.price)}g</span>
                    · yields ~${formatGold((v.price || 0) * MS.INCOME_RATE_PER_HOUR)}/h</div>
                  <div class="meta">${fettered ? `⛓ Fettered (~${remain}m left)` : "Unchained"}</div>
                </div>
                <div class="player-actions">
                  <button type="button" class="btn btn-amethyst btn-sm" data-fetter="${escapeHtml(v.id)}"
                    ${fettered ? "disabled" : ""}>
                    ${fettered ? "Chained" : "Fetter"}
                  </button>
                </div>
              </div>`;
          })
          .join("");

      list.querySelectorAll("[data-fetter]").forEach((btn) => {
        btn.addEventListener("click", () => this.fetterVassal(btn.getAttribute("data-fetter")));
      });
    } catch (err) {
      console.error(err);
      list.innerHTML = `<div class="empty-state"><p>Could not load plantation.</p></div>`;
    }
  },

  /**
   * Buy another player:
   *  - Cost = target.price
   *  - After purchase: target.price *= 1.20
   *  - Gold moves buyer → previous owner (or nowhere if free)
   *  - Update vassals lists + notify target
   */
  async buyPlayer(targetId) {
    if (!firebaseReady || !this.me) return;
    const buyerId = this.me.id;

    try {
      await db.runTransaction(async (tx) => {
        const buyerRef = db.collection(MS.COLLECTION_PLAYERS).doc(buyerId);
        const targetRef = db.collection(MS.COLLECTION_PLAYERS).doc(targetId);

        const buyerSnap = await tx.get(buyerRef);
        const targetSnap = await tx.get(targetRef);
        if (!buyerSnap.exists || !targetSnap.exists) throw new Error("Player not found");

        const buyer = buyerSnap.data();
        const target = targetSnap.data();

        if (target.nickname === this.currentNick) throw new Error("Cannot buy yourself");
        if ((target.fetteredUntil || 0) > Date.now()) throw new Error("Target is fettered");
        if (target.ownerName === this.currentNick) throw new Error("Already your vassal");

        // Prevent buying your own master chain simply (optional soft check)
        if (buyer.ownerName === target.nickname) {
          throw new Error("You cannot buy your current master");
        }

        const price = Math.ceil(target.price || MS.BASE_PRICE);
        if ((buyer.gold || 0) < price) throw new Error("Not enough gold — farm more!");

        const prevOwnerId = target.ownerId || null;
        let prevOwnerRef = null;
        let prevOwner = null;
        if (prevOwnerId) {
          prevOwnerRef = db.collection(MS.COLLECTION_PLAYERS).doc(prevOwnerId);
          const prevSnap = await tx.get(prevOwnerRef);
          if (prevSnap.exists) prevOwner = prevSnap.data();
        }

        const newPrice = Math.ceil(price * MS.PRICE_MULTIPLIER);

        // Buyer pays
        tx.update(buyerRef, {
          gold: (buyer.gold || 0) - price,
          vassals: firebase.firestore.FieldValue.arrayUnion(targetId),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        // Previous owner loses vassal, gains gold
        if (prevOwnerRef && prevOwner) {
          tx.update(prevOwnerRef, {
            gold: (prevOwner.gold || 0) + price,
            vassals: firebase.firestore.FieldValue.arrayRemove(targetId),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        }

        // Target reassigned
        tx.update(targetRef, {
          ownerId: buyerId,
          ownerName: this.currentNick,
          price: newPrice,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Events outside transaction
      const targetSnap = await db.collection(MS.COLLECTION_PLAYERS).doc(targetId).get();
      const tName = targetSnap.data()?.nickname || "someone";
      await writeGameEvent(
        tName,
        `You were purchased by player ${this.currentNick}! Your price rose ×1.20.`,
        { type: "purchased", by: this.currentNick }
      );
      toast(`You claimed ${tName}!`);
    } catch (err) {
      console.error(err);
      toast(err.message || "Purchase failed.", "error");
    }
  },

  async fetterVassal(vassalId) {
    if (!firebaseReady || !this.me) return;
    try {
      const ref = db.collection(MS.COLLECTION_PLAYERS).doc(vassalId);
      const snap = await ref.get();
      if (!snap.exists) throw new Error("Vassal not found");
      const v = snap.data();
      if (v.ownerName !== this.currentNick) throw new Error("Not your vassal");

      const until = Date.now() + MS.FETTER_MS;
      await ref.update({
        fetteredUntil: until,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      await writeGameEvent(
        v.nickname,
        `${this.currentNick} fettered you — others cannot buy you for a while.`,
        { type: "fetter", by: this.currentNick }
      );
      toast(`Fettered ${v.nickname}`);
      this.renderPlantation();
    } catch (err) {
      toast(err.message || "Fetter failed.", "error");
    }
  },

  /**
   * Self-buyout: pay Price × 1.10 to current master (or burn if none — shouldn't happen)
   * Freedom: owner cleared; price stays (or slight bump optional)
   */
  async selfBuyout() {
    if (!firebaseReady || !this.me) return;
    if (!this.me.ownerName) {
      toast("You are already free.");
      return;
    }

    const cost = Math.ceil((this.me.price || MS.BASE_PRICE) * MS.BUYOUT_PENALTY);
    if ((this.me.gold || 0) < cost) {
      toast(`Need ${formatGold(cost)} gold to buy freedom.`, "error");
      return;
    }

    try {
      await db.runTransaction(async (tx) => {
        const meRef = db.collection(MS.COLLECTION_PLAYERS).doc(this.me.id);
        const meSnap = await tx.get(meRef);
        if (!meSnap.exists) throw new Error("Player missing");
        const me = meSnap.data();
        if (!me.ownerId) throw new Error("Already free");

        const pay = Math.ceil((me.price || MS.BASE_PRICE) * MS.BUYOUT_PENALTY);
        if ((me.gold || 0) < pay) throw new Error("Not enough gold");

        const masterRef = db.collection(MS.COLLECTION_PLAYERS).doc(me.ownerId);
        const masterSnap = await tx.get(masterRef);
        const master = masterSnap.exists ? masterSnap.data() : null;

        tx.update(meRef, {
          gold: (me.gold || 0) - pay,
          ownerId: null,
          ownerName: null,
          fetteredUntil: 0,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        if (masterSnap.exists) {
          tx.update(masterRef, {
            gold: (master.gold || 0) + pay,
            vassals: firebase.firestore.FieldValue.arrayRemove(this.me.id),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        }
      });

      await writeGameEvent(
        this.me.ownerName,
        `${this.currentNick} bought their freedom from you!`,
        { type: "buyout", by: this.currentNick }
      );
      toast("You are free once more! 🕊️");
    } catch (err) {
      console.error(err);
      toast(err.message || "Buyout failed.", "error");
    }
  },

  /**
   * Accrue passive income:
   * For each vassal, gold += price * 0.05 * (elapsedHours)
   */
  async accrueIncome() {
    if (!firebaseReady || !this.me) return;
    const vassalIds = Array.isArray(this.me.vassals) ? this.me.vassals : [];
    if (!vassalIds.length) return;

    const now = Date.now();
    const last = this.me.lastIncomeAt || now;
    const elapsedMs = Math.max(0, now - last);
    if (elapsedMs < MS.INCOME_TICK_MS - 500) return;

    const hours = elapsedMs / 3600000;
    if (hours <= 0) return;

    try {
      // Read vassal prices
      let totalGain = 0;
      for (const id of vassalIds) {
        const s = await db.collection(MS.COLLECTION_PLAYERS).doc(id).get();
        if (!s.exists) continue;
        const price = s.data().price || MS.BASE_PRICE;
        totalGain += price * MS.INCOME_RATE_PER_HOUR * hours;
      }
      totalGain = Math.floor(totalGain);
      if (totalGain < 1) {
        // Still bump lastIncomeAt so we don't reprocess tiny intervals forever
        if (hours > 0.01) {
          await db.collection(MS.COLLECTION_PLAYERS).doc(this.me.id).update({
            lastIncomeAt: now,
          });
        }
        return;
      }

      await db.collection(MS.COLLECTION_PLAYERS).doc(this.me.id).update({
        gold: firebase.firestore.FieldValue.increment(totalGain),
        lastIncomeAt: now,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error("[Fable] income:", err);
    }
  },
};

// ============================================================================
//  Page bootstraps
// ============================================================================
async function bootLogin() {
  redirectIfAuthed();

  const form = document.getElementById("login-form");
  const input = document.getElementById("nickname");
  const err = document.getElementById("login-error");
  if (!form || !input) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) {
      if (err) err.textContent = "Enter a nickname to enter the realm.";
      input.focus();
      return;
    }
    if (name.length < 2) {
      if (err) err.textContent = "Nickname must be at least 2 characters.";
      return;
    }
    if (name.length > 24) {
      if (err) err.textContent = "Keep it under 24 characters.";
      return;
    }
    if (!/^[\w\s.\-]+$/u.test(name)) {
      if (err) err.textContent = "Use letters, numbers, spaces, . or - only.";
      return;
    }
    if (err) err.textContent = "";
    setNickname(name);
    const wrap = document.querySelector(".login-wrap");
    if (wrap) wrap.classList.add("is-leaving");
    setTimeout(() => {
      window.location.href = "feed.html";
    }, 280);
  });
}

async function bootFeed() {
  const nick = requireAuth();
  if (!nick) return;

  await initFirebase();
  const page = document.querySelector(".page");
  showConfigBanner(page);
  setLiveDot(firebaseReady);

  if (firebaseReady) await ensurePlayerRecord(nick);

  wireBottomNav("feed");
  ensureModal();

  const list = document.getElementById("feed-list");
  if (list) subscribeFeed(list, nick);
}

async function bootProfile() {
  const nick = requireAuth();
  if (!nick) return;

  await initFirebase();
  const page = document.querySelector(".page");
  showConfigBanner(page);

  const nameEl = document.getElementById("profile-name");
  const avatarEl = document.getElementById("profile-avatar");
  if (nameEl) nameEl.textContent = nick;
  if (avatarEl) avatarEl.textContent = avatarLetter(nick);

  if (firebaseReady) await ensurePlayerRecord(nick);

  wireBottomNav("profile");
  ensureModal();

  const grid = document.getElementById("profile-grid");
  const stats = document.getElementById("profile-stats");
  if (grid) subscribeProfile(grid, stats, nick);

  const notif = document.getElementById("notif-list");
  if (notif) subscribeNotifications(notif, nick);

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    clearNickname();
    navigateTo("index.html");
  });
}

async function bootGames() {
  const nick = requireAuth();
  if (!nick) return;

  await initFirebase();
  const page = document.querySelector(".page");
  showConfigBanner(page);
  setLiveDot(firebaseReady);

  if (firebaseReady) await ensurePlayerRecord(nick);

  wireBottomNav("games");
  ensureModal();

  // Mini-game launchers (games.js MiniGames)
  document.querySelectorAll("[data-play-game]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-play-game");
      if (window.MiniGames && typeof window.MiniGames.open === "function") {
        window.MiniGames.open(id);
      } else {
        toast("Game engine failed to load.", "error");
      }
    });
  });

  // Publication CTA → create post modal
  document.getElementById("pub-create-btn")?.addEventListener("click", () => {
    openCreateModal();
  });

  // Open Masters & Slaves
  const openMs = document.getElementById("open-masters");
  const hub = document.getElementById("games-hub");
  const msPanel = document.getElementById("ms-panel");
  const back = document.getElementById("ms-back");

  function showHub() {
    if (window.MiniGames) window.MiniGames.close();
    MastersSlaves.stop();
    msPanel?.classList.remove("active");
    const arena = document.getElementById("mini-arena");
    if (arena) {
      arena.classList.remove("active");
      arena.setAttribute("hidden", "");
    }
    if (hub) {
      hub.style.display = "";
      hub.style.animation = "none";
      void hub.offsetWidth;
      hub.style.animation = "";
    }
  }

  openMs?.addEventListener("click", () => {
    if (window.MiniGames) window.MiniGames.close();
    hub?.classList.add("is-leaving");
    setTimeout(() => {
      if (hub) {
        hub.style.display = "none";
        hub.classList.remove("is-leaving");
      }
      document.getElementById("mini-arena")?.setAttribute("hidden", "");
      msPanel?.classList.add("active");
      MastersSlaves.start(nick);
    }, 220);
  });

  back?.addEventListener("click", (e) => {
    e.preventDefault();
    showHub();
  });

  document.getElementById("mini-back")?.addEventListener("click", (e) => {
    e.preventDefault();
    showHub();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "login") bootLogin();
  else if (page === "feed") bootFeed();
  else if (page === "profile") bootProfile();
  else if (page === "games") bootGames();
});
