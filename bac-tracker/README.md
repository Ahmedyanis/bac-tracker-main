# Bac Tracker

Mobile-first Bac lesson and teacher tracking app. React + Tailwind CSS + Lucide icons.
Data is saved in the browser's `localStorage`, so it stays on the phone/browser it's opened in.

## 1. Push this folder to GitHub

```bash
cd bac-tracker
git init
git add .
git commit -m "Bac tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/bac-tracker.git
git push -u origin main
```

(No GitHub yet? Create a new empty repo at github.com/new first, then run the commands above.)

## 2. Deploy on Vercel

1. Go to vercel.com, sign in (GitHub login is easiest).
2. Click **Add New → Project**, pick the `bac-tracker` repo.
3. Vercel auto-detects Vite — leave the defaults (Build Command: `vite build`, Output: `dist`).
4. Click **Deploy**. You'll get a URL like `bac-tracker.vercel.app`.

## 3. Put it on your phone

Open the Vercel URL on your phone's browser, then add it to your home screen so it behaves like an app:

- **Android (Chrome):** tap the ⋮ menu → **Add to Home screen** (or **Install app** if it appears).
- **iPhone (Safari):** tap the Share icon → **Add to Home Screen**.

It'll open full-screen without browser chrome, keep a home-screen icon, and (thanks to the PWA setup already wired in) keep working if your connection drops.

## Local development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. On your phone, connect to the same Wi-Fi and visit
`http://<your-computer's-local-IP>:5173` (run `npm run dev -- --host` to expose it).

## Notes

- All data (teachers, sessions, payments) lives in `localStorage` in the browser — it does not sync between devices. If you install the app on two phones, they'll have separate data.
- App icons: replace `public/icon-192.png` and `public/icon-512.png` with your own 192×192 and 512×512 PNGs (any square logo works) before deploying, so the home-screen icon looks right. Placeholders are not included.
- Browser notifications (session reminders) only fire while the app tab/PWA is open in the foreground or backgrounded on some browsers — true background push would need a server component, which this app doesn't have.
