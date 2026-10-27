import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const KEY = (process.env.GEMINI_API_KEY || "").trim();
let MODEL = (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
const PORT = process.env.PORT || 3000;
const API = "https://generativelanguage.googleapis.com/v1beta";
const CLASSES = ["healthy", "bact", "mildew", "late", "virus"];

const PROMPT = `Sen o‘simlik kasalliklari bo‘yicha agronomsan. Rasmdagi pomidor bargini tahlil qil.
Faqat JSON qaytar, boshqa matn yozma. Format:
{"key": "healthy|bact|mildew|late|virus|other",
 "scores": {"healthy": 0-100, "bact": 0-100, "mildew": 0-100, "late": 0-100, "virus": 0-100},
 "izoh": "rasmda nima ko‘rinayotgani haqida 1-2 gap, o‘zbek tilida"}
Kalitlar: healthy=sog‘lom, bact=bakterial dog‘, mildew=un-kukun, late=kech kuydirgi, virus=virusli kasallik.
Agar rasmda o‘simlik bargi bo‘lmasa yoki juda xira bo‘lsa, key="other" qil.
scores yig‘indisi 100 bo‘lsin.`;

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 600000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 30;
}

async function listModels() {
  const r = await fetch(`${API}/models?pageSize=100`, { headers: { "x-goog-api-key": KEY } });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || "ListModels xatosi");
  return (d.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map(m => m.name.replace("models/", ""));
}
async function pickModel() {
  const names = await listModels();
  const good = names.filter(n => /flash/.test(n) && !/(image|tts|live|audio|thinking|lite|exp)/.test(n)).sort().reverse();
  return good[0] || names[0];
}
let WORKING = null;
async function candidates() {
  const base = [WORKING, MODEL, "gemini-flash-latest", "gemini-flash-lite-latest"].filter(Boolean);
  let more = [];
  try {
    more = (await listModels())
      .filter(n => /flash/.test(n) && !/(image|tts|live|audio|thinking|exp|omni|robotics|computer|embedding)/.test(n))
      .sort().reverse();
  } catch (e) {}
  return [...new Set([...base, ...more])].slice(0, 8);
}
async function call(model, image, mime) {
  const r = await fetch(`${API}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: image } }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
    })
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}

app.use(express.json({ limit: "8mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Tekshiruv: brauzerda /api/health ni oching
app.get("/api/health", async (req, res) => {
  const out = { keySet: !!KEY, keyStart: KEY ? KEY.slice(0, 4) + "…" : null, keyLength: KEY.length, model: MODEL };
  if (KEY) {
    try { out.availableModels = (await listModels()).slice(0, 12); }
    catch (e) { out.listModelsError = e.message; }
  }
  res.json(out);
});

app.post("/api/analyze", async (req, res) => {
  if (!KEY) return res.status(500).json({ error: "Serverda GEMINI_API_KEY topilmadi. .env faylini saqlang va serverni qayta ishga tushiring" });
  if (limited(req.ip)) return res.status(429).json({ error: "Juda ko‘p so‘rov. Birozdan so‘ng urinib ko‘ring" });
  const { image, mime } = req.body || {};
  if (!image || !/^image\/(jpeg|png|webp)$/.test(mime || "")) return res.status(400).json({ error: "Noto‘g‘ri rasm" });

  try {
    let r, tried = [];
    for (const m of await candidates()) {
      r = await call(m, image, mime);
      if (r.ok) { WORKING = m; MODEL = m; break; }
      const msg = r.data?.error?.message || "noma’lum xato";
      console.log(`Model ishlamadi: ${m} (${r.status}) ${msg.slice(0, 120)}`);
      tried.push(`${m} → ${r.status}`);
      if (![403, 404, 429, 503].includes(r.status)) break;
    }
    if (!r.ok) {
      const msg = (r.data?.error?.message || "noma’lum xato").slice(0, 220);
      return res.status(502).json({ error: `Gemini (${r.status}): ${msg} | Sinalgan modellar: ${tried.join(", ")}` });
    }
    let txt = r.data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
    txt = txt.replace(/```json|```/g, "").trim();
    if (!txt) return res.status(502).json({ error: "Gemini bo‘sh javob berdi (rasm bloklangan bo‘lishi mumkin)" });
    const out = JSON.parse(txt);

    const scores = {};
    let sum = 0;
    for (const k of CLASSES) { scores[k] = Math.max(0, Number(out.scores?.[k]) || 0); sum += scores[k]; }
    if (sum > 0) for (const k of CLASSES) scores[k] = (scores[k] / sum) * 100;
    let key = out.key === "other" ? "other" : CLASSES.includes(out.key) ? out.key : null;
    if (!key) key = [...CLASSES].sort((a, b) => scores[b] - scores[a])[0];
    const conf = key === "other" ? Math.max(...Object.values(scores), 0) : scores[key];
    res.json({ key, conf, scores, izoh: String(out.izoh || "").slice(0, 300) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server xatosi: " + e.message });
  }
});

app.listen(PORT, () => console.log(`Bargnoma: http://localhost:${PORT}  (kalit: ${KEY ? "bor" : "YO‘Q"}, model: ${MODEL})`));
