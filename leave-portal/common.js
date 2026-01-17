// ====== إعدادات عامة ======
const CONFIG = {
  API_BASE: "https://leave-system-1af0.onrender.com", // غيّرها حسب السيرفر بتاعك
  TOKEN_KEY: "ulm_jwt_token"
};

function getToken() {
  return localStorage.getItem(CONFIG.TOKEN_KEY) || "";
}
function setToken(t) {
  localStorage.setItem(CONFIG.TOKEN_KEY, t.trim());
}
function clearToken() {
  localStorage.removeItem(CONFIG.TOKEN_KEY);
}

// ====== Helpers ======
function qs(sel, root=document){ return root.querySelector(sel); }
function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

function fmtDate(s){
  if(!s) return "-";
  const d = new Date(s);
  if(Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("ar-EG", {year:"numeric", month:"2-digit", day:"2-digit"});
}

function statusBadge(status){
  const s = String(status || "").toLowerCase();
  if(s.includes("approved")) return `<span class="badge good">✅ Approved</span>`;
  if(s.includes("rejected")) return `<span class="badge bad">⛔ Rejected</span>`;
  if(s.includes("pending"))  return `<span class="badge warn">⏳ Pending</span>`;
  if(s.includes("cancel"))   return `<span class="badge bad">🛑 Canceled</span>`;
  return `<span class="badge">ℹ️ ${escapeHtml(status || "-")}</span>`;
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function toast(title, msg, type = ""){
  const el = qs("#toast");
  if(!el) return;
  qs(".title", el).textContent = title;
  qs(".msg", el).textContent = msg || "";
  
  // Clean up previous types
  el.classList.remove("error", "success", "warn");
  if(type) el.classList.add(type);

  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(()=> el.classList.remove("show"), 3200);
}

// ====== Fetch Wrapper ======
async function apiFetch(path, { method="GET", body=null, headers={}, isForm=false } = {}){
  const token = getToken();
  const url = CONFIG.API_BASE.replace(/\/$/,"") + path;

  const h = new Headers(headers);
  if(token) h.set("Authorization", `Bearer ${token}`);
  if(body && !isForm && !(body instanceof FormData)) h.set("Content-Type", "application/json");

  const res = await fetch(url, {
    method,
    headers: h,
    body: body ? (isForm || body instanceof FormData ? body : JSON.stringify(body)) : null
  });

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }

  if(!res.ok){
    const msg = (json?.data?.message) || (json?.message) || res.statusText || "Request failed";
    const err = new Error(msg);
    err.status = res.status;
    err.payload = json;
    throw err;
  }

  return json;
}

// ====== Modal ======
function openModal(html){
  const modal = qs("#modal");
  const body = qs("#modalBody");
  body.innerHTML = html;
  modal.classList.add("show");
}
function closeModal(){
  const modal = qs("#modal");
  modal.classList.remove("show");
  qs("#modalBody").innerHTML = "";
}
function wireModalClose(){
  const modal = qs("#modal");
  modal.addEventListener("click", (e)=>{
    if(e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape") closeModal();
  });
}
