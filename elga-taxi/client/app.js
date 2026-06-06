/* ELGA TAXI Mini App — frontend logikasi */

// Backend manzili. Agar client backend bilan bitta domendan tarqatilsa,
// bo'sh qoldiring ("" = nisbiy yo'l). Aks holda to'liq URL kiriting.
const API_BASE = "";

const tg = window.Telegram ? window.Telegram.WebApp : null;
let token = null;

// ---------- Yordamchilar ----------
function $(id) { return document.getElementById(id); }

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

async function api(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  if (token) headers["Authorization"] = "Bearer " + token;
  if (!isForm) headers["Content-Type"] = "application/json";
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

// ---------- Telegram integratsiyasi ----------
function initTelegram() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  // Orqaga tugmasi
  tg.BackButton.onClick(() => tg.close());
}

// ---------- Avto-kirish ----------
async function login() {
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) {
    // Telegramdan tashqarida ochilgan — dev rejimi (backendda ALLOW_BROWSER_DEV=1 bo'lsa ishlaydi)
    $("user-badge").textContent = "Brauzer (dev)";
  }
  try {
    const data = await api("/api/auth/telegram", {
      method: "POST",
      body: { init_data: initData },
    });
    token = data.token;
    const u = data.user;
    $("user-badge").textContent = u.first_name || "Mehmon";
    await loadOrders();
  } catch (e) {
    $("user-badge").textContent = "Kirish xatosi";
    toast("Kirish muvaffaqiyatsiz: " + e.message);
  }
}

// ---------- Ovozli buyurtma ----------
let mediaRecorder = null;
let chunks = [];

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      sendVoice(new Blob(chunks, { type: "audio/webm" }));
    };
    mediaRecorder.start();
    $("mic-btn").classList.add("recording");
    $("mic-btn").textContent = "⏺️ Yozilmoqda… (qo'yib yuboring)";
    $("voice-status").textContent = "Gapiring…";
    if (tg) tg.HapticFeedback?.impactOccurred("medium");
  } catch (e) {
    toast("Mikrofonga ruxsat yo'q: " + e.message);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    $("mic-btn").classList.remove("recording");
    $("mic-btn").textContent = "🎤 Bosib gapiring";
  }
}

async function sendVoice(blob) {
  $("voice-status").textContent = "🧠 AI tinglamoqda…";
  const form = new FormData();
  form.append("audio", blob, "voice.webm");
  try {
    const data = await api("/api/voice", { method: "POST", body: form, isForm: true });
    $("transcript").textContent = data.transcript ? "“" + data.transcript + "”" : "";
    const o = data.order || {};
    if (o.from_address) $("from").value = o.from_address;
    if (o.to_address) $("to").value = o.to_address;
    if (o.when_text) $("when").value = o.when_text;
    if (o.notes) $("notes").value = o.notes;
    $("voice-status").textContent = "✅ Tayyor — tekshirib, buyurtma bering";
    if (tg) tg.HapticFeedback?.notificationOccurred("success");
  } catch (e) {
    $("voice-status").textContent = "";
    toast("AI xatosi: " + e.message);
  }
}

// ---------- Joylashuv ----------
function detectLocation() {
  if (!navigator.geolocation) return toast("Joylashuv qo'llab-quvvatlanmaydi");
  $("loc-btn").textContent = "📍 Aniqlanmoqda…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      $("from").value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      $("loc-btn").textContent = "📍 Joylashuvni aniqlash";
      toast("Joylashuv qo'yildi");
    },
    () => {
      $("loc-btn").textContent = "📍 Joylashuvni aniqlash";
      toast("Joylashuvni olishbo'lmadi");
    }
  );
}

// ---------- Buyurtma ----------
async function submitOrder() {
  const body = {
    from_address: $("from").value.trim(),
    to_address: $("to").value.trim(),
    when_text: $("when").value.trim(),
    notes: $("notes").value.trim(),
  };
  if (!body.from_address || !body.to_address) {
    return toast("Qayerdan va qayerga to'ldiring");
  }
  try {
    await api("/api/orders", { method: "POST", body });
    toast("✅ Buyurtma qabul qilindi!");
    if (tg) tg.HapticFeedback?.notificationOccurred("success");
    ["from", "to", "when", "notes"].forEach((id) => ($(id).value = ""));
    $("transcript").textContent = "";
    $("voice-status").textContent = "";
    await loadOrders();
  } catch (e) {
    toast("Xato: " + e.message);
  }
}

async function loadOrders() {
  try {
    const orders = await api("/api/orders");
    const box = $("orders");
    if (!orders.length) { box.textContent = "Hozircha buyurtma yo'q"; return; }
    box.innerHTML = "";
    orders.forEach((o) => {
      const el = document.createElement("div");
      el.className = "order-item";
      el.innerHTML = `<span class="route">${o.from_address || "?"} → ${o.to_address || "?"}</span>
                      <span class="st">${o.status}</span>`;
      box.appendChild(el);
    });
  } catch (_) {
    $("orders").textContent = "Yuklab bo'lmadi";
  }
}

// ---------- Hodisalar ----------
function bindEvents() {
  const mic = $("mic-btn");
  // Bosib turish: sichqoncha + sensorli ekran
  mic.addEventListener("mousedown", startRecording);
  mic.addEventListener("mouseup", stopRecording);
  mic.addEventListener("mouseleave", stopRecording);
  mic.addEventListener("touchstart", (e) => { e.preventDefault(); startRecording(); }, { passive: false });
  mic.addEventListener("touchend", (e) => { e.preventDefault(); stopRecording(); }, { passive: false });

  $("loc-btn").addEventListener("click", detectLocation);
  $("submit-btn").addEventListener("click", submitOrder);
}

// ---------- Ishga tushirish ----------
initTelegram();
bindEvents();
login();
