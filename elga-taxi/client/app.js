/* ===== ELGA TAXI — Mini App (mockup dizayni) ===== */

// Backend client bilan bitta domendan tarqatilsa "" qoldiring.
const API_BASE = "";

const tg = window.Telegram ? window.Telegram.WebApp : null;
let token = null;
const state = {
  from: "Joriy joylashuv",
  to: "",
  tariff: "Tejamkor",
  price: "13 500",
  pay: "Naqd",
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}

function haptic(type = "impact", style = "medium") {
  if (tg && tg.HapticFeedback) {
    if (type === "impact") tg.HapticFeedback.impactOccurred(style);
    else tg.HapticFeedback.notificationOccurred(style);
  }
}

// ---------- API ----------
async function api(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  if (token) headers["Authorization"] = "Bearer " + token;
  if (!isForm) headers["Content-Type"] = "application/json";
  const res = await fetch(API_BASE + path, {
    method, headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

// ---------- Ekran navigatsiyasi ----------
const MAIN_TABS = ["screen-home", "screen-tariff", "screen-history", "screen-profile"];
function showScreen(id) {
  $$(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  window.scrollTo(0, 0);
  // Pastki nav faqat asosiy tablarda
  $("#bottom-nav").style.display = MAIN_TABS.includes(id) ? "flex" : "none";
  $$(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.nav === id));
  // Telegram orqaga tugmasi
  if (tg) {
    if (id === "screen-home") tg.BackButton.hide();
    else tg.BackButton.show();
  }
  if (id === "screen-history") loadHistory();
}

// ---------- Stilizatsiya qilingan xarita (SVG) ----------
function mapSvg() {
  return `<svg viewBox="0 0 400 320" preserveAspectRatio="xMidYMid slice">
    <rect width="400" height="320" fill="#EAEDF0"/>
    <g stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round">
      <path d="M-20 90 H 420"/><path d="M-20 220 H 420"/>
      <path d="M120 -20 V 340"/><path d="M280 -20 V 340"/>
    </g>
    <g stroke="#DDE2E7" stroke-width="4" fill="none">
      <path d="M-20 150 H 420"/><path d="M200 -20 V 340"/>
    </g>
    <g fill="#DCE6DC">
      <rect x="20" y="110" width="80" height="90" rx="8"/>
      <rect x="300" y="20" width="80" height="50" rx="8"/>
    </g>
  </svg>`;
}
function renderHomeMap() {
  $("#home-map").innerHTML = mapSvg() +
    `<div class="car-dot" style="left:24%;top:55%">🚕</div>` +
    `<div class="me-dot" style="left:52%;top:48%"></div>`;
}
function renderDriverMap() {
  $("#driver-map").innerHTML = mapSvg() +
    `<svg viewBox="0 0 400 320" style="position:absolute;inset:0" preserveAspectRatio="xMidYMid slice">
       <path d="M90 240 C 160 200, 180 120, 300 70" stroke="#FFB300" stroke-width="6"
             fill="none" stroke-linecap="round" stroke-dasharray="2 10"/>
     </svg>` +
    `<div class="pin" style="left:75%;top:22%">📍</div>` +
    `<div class="car-dot" style="left:22%;top:75%">🚕</div>` +
    `<div class="me-dot" style="left:62%;top:62%"></div>` +
    `<div class="eta-bubble" style="left:38%;top:42%">2 daqiqa<b>masofada</b></div>`;
}

// ---------- Avto-kirish ----------
async function login() {
  const initData = tg && tg.initData ? tg.initData : "";
  try {
    const data = await api("/api/auth/telegram", { method: "POST", body: { init_data: initData } });
    token = data.token;
    const u = data.user;
    const name = u.first_name || "Mehmon";
    $("#home-greet").textContent = `Salom, ${name} 👋`;
    $("#profile-name").textContent = name;
    $("#profile-username").textContent = u.username ? "@" + u.username : "";
    const initial = name.trim().charAt(0).toUpperCase() || "🙂";
    $("#home-avatar").textContent = initial;
    $("#profile-avatar").textContent = initial;
  } catch (e) {
    $("#home-greet").textContent = "Salom! 👋";
    toast("Kirish: " + e.message);
  }
}

// ---------- Joylashuv ----------
function detectLocation() {
  if (!navigator.geolocation) { $("#home-loc").textContent = "Toshkent"; return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const s = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      $("#home-loc").textContent = s;
      state.from = s;
    },
    () => { $("#home-loc").textContent = "Toshkent"; }
  );
}

// ---------- Ovozli buyurtma ----------
let mediaRecorder = null, chunks = [];

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (chunks.length) sendVoice(new Blob(chunks, { type: "audio/webm" }));
    };
    mediaRecorder.start();
    $("#voice-mic").classList.add("live");
    $("#voice-title").textContent = "Gapiring…";
    $("#voice-hint").textContent = "Qo'yib yuborganda yuboriladi";
    haptic("impact", "medium");
  } catch (e) {
    toast("Mikrofonga ruxsat yo'q");
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    $("#voice-mic").classList.remove("live");
    $("#voice-title").textContent = "Bosib gapiring";
  }
}

async function sendVoice(blob) {
  $("#voice-title").textContent = "Tinglanmoqda…";
  $("#voice-hint").textContent = "🧠 AI manzilni aniqlamoqda";
  const form = new FormData();
  form.append("audio", blob, "voice.webm");
  try {
    const data = await api("/api/voice", { method: "POST", body: form, isForm: true });
    const o = data.order || {};
    const dest = o.to_address || o.from_address || data.transcript || "";
    if (o.from_address && o.to_address) state.from = o.from_address;
    if (!dest) {
      $("#voice-title").textContent = "Bosib gapiring";
      $("#voice-hint").textContent = "Tushunmadim, qayta urinib ko'ring";
      return;
    }
    state.to = dest;
    haptic("notify", "success");
    openTariff();
  } catch (e) {
    $("#voice-title").textContent = "Bosib gapiring";
    $("#voice-hint").textContent = "Xato, qayta urinib ko'ring";
    toast("AI: " + e.message);
  }
}

// ---------- Tarif ----------
function openTariff() {
  $("#dest-val").textContent = state.to || "Tanlanmagan";
  showScreen("screen-tariff");
}

async function confirmOrder() {
  if (!state.to) { toast("Avval manzilni ayting"); showScreen("screen-voice"); return; }
  try {
    await api("/api/orders", {
      method: "POST",
      body: {
        from_address: state.from || "Joriy joylashuv",
        to_address: state.to,
        when_text: "hozir",
        notes: `${state.tariff} · ${state.pay}`,
      },
    });
    haptic("notify", "success");
    renderDriverMap();
    showScreen("screen-driver");
  } catch (e) {
    toast("Xato: " + e.message);
  }
}

// ---------- Tarix ----------
async function loadHistory() {
  const box = $("#history-list");
  try {
    const orders = await api("/api/orders");
    if (!orders.length) { box.innerHTML = `<div class="empty">Hozircha buyurtma yo'q 🚖</div>`; return; }
    box.innerHTML = "";
    orders.forEach((o) => {
      const el = document.createElement("div");
      el.className = "list-item";
      el.innerHTML = `<div><div class="route">${o.from_address || "?"} → ${o.to_address || "?"}</div>
                      <div class="when">${o.when_text || ""}</div></div>
                      <div class="st">${o.status}</div>`;
      box.appendChild(el);
    });
  } catch (_) {
    box.innerHTML = `<div class="empty">Yuklab bo'lmadi</div>`;
  }
}

// ---------- Telefon qo'ng'irog'i ----------
function callDriver() {
  window.location.href = "tel:+998000000000";
}

// ---------- Hodisalar ----------
function bind() {
  // Home mic → voice ekrani
  $("#home-mic").addEventListener("click", () => showScreen("screen-voice"));

  // Voice big mic: bosib turish
  const vm = $("#voice-mic");
  vm.addEventListener("mousedown", startRecording);
  vm.addEventListener("mouseup", stopRecording);
  vm.addEventListener("mouseleave", stopRecording);
  vm.addEventListener("touchstart", (e) => { e.preventDefault(); startRecording(); }, { passive: false });
  vm.addEventListener("touchend", (e) => { e.preventDefault(); stopRecording(); }, { passive: false });

  // Saqlangan manzillar
  $$(".saved").forEach((s) => s.addEventListener("click", () => {
    state.to = s.dataset.place === "Uy" ? "Uy" : "Ish";
    openTariff();
  }));

  // Orqaga tugmalari
  $$("[data-back]").forEach((b) => b.addEventListener("click", () => showScreen(b.dataset.back)));

  // Tarif tanlash
  $$("#tariffs .tariff").forEach((t) => t.addEventListener("click", () => {
    $$("#tariffs .tariff").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    state.tariff = t.dataset.name; state.price = t.dataset.price;
  }));

  // To'lov
  $$("#pay .pay").forEach((p) => p.addEventListener("click", () => {
    $$("#pay .pay").forEach((x) => x.classList.remove("active"));
    p.classList.add("active");
    state.pay = p.dataset.pay;
  }));

  $("#confirm-btn").addEventListener("click", confirmOrder);
  $("#cancel-btn").addEventListener("click", () => { toast("Buyurtma bekor qilindi"); showScreen("screen-home"); });
  $("#driver-call").addEventListener("click", callDriver);
  $("#driver-call-2").addEventListener("click", callDriver);

  // Pastki navigatsiya
  $$(".nav-item").forEach((n) => n.addEventListener("click", () => showScreen(n.dataset.nav)));
}

// ---------- Ishga tushirish ----------
function init() {
  if (tg) {
    tg.ready(); tg.expand();
    tg.BackButton.onClick(() => showScreen("screen-home"));
    if (tg.setHeaderColor) tg.setHeaderColor("#FFFFFF");
  }
  bind();
  renderHomeMap();
  detectLocation();
  login();
  showScreen("screen-home");
}
init();
