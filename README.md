# Bargnoma 🌿

O‘simlik (pomidor) barg kasalliklarini Google Gemini yordamida aniqlovchi veb-sayt.

## Mahalliy ishga tushirish

1. Node.js 18+ o‘rnating.
2. Gemini API kalitini oling: https://aistudio.google.com/apikey
3. Terminalda (VS Code: `Ctrl+``):
   ```bash
   npm install
   cp .env.example .env     # Windows: copy .env.example .env
   ```
4. `.env` faylini ochib `GEMINI_API_KEY` ga kalitingizni yozing.
5. `npm start` va brauzerda http://localhost:3000 ni oching.

> API kalit faqat serverda turadi (`server.js`). Uni hech qachon `public/` ichiga yozmang.

## GitHub'ga joylash

```bash
git init
git add .
git commit -m "Bargnoma: birinchi versiya"
git branch -M main
git remote add origin https://github.com/FOYDALANUVCHI/bargnoma.git
git push -u origin main
```
(Avval github.com da bo‘sh `bargnoma` repozitoriysini yarating. `.env` fayli `.gitignore` da, GitHub'ga chiqmaydi.)

## Internetga chiqarish (Render, bepul reja)

GitHub Pages faqat statik sayt uchun, server ishlamaydi va kalit ochiq qolardi. Shuning uchun:

1. https://render.com da GitHub bilan kiring → **New → Web Service** → repozitoriyni tanlang.
2. Build Command: `npm install`  ·  Start Command: `npm start`
3. **Environment** bo‘limida `GEMINI_API_KEY` (va xohlasangiz `GEMINI_MODEL`) qo‘shing.
4. Deploy tugagach, sayt manzili beriladi.

Model nomi o‘zgarsa, faqat `GEMINI_MODEL` qiymatini yangilang: https://ai.google.dev/gemini-api/docs/models
