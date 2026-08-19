# Bac Tracker

Mobile-first Bac lesson and teacher tracking app. React + Tailwind CSS + Lucide icons.
Data syncs live across phones through Firebase (sign in with the same email/password on
each phone), with a local cache so the app still works offline.

## 0. Set up Firebase (do this once, before deploying)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click
   **Add project**. Name it anything (e.g. `bac-tracker`) and finish the wizard — you can
   skip Google Analytics.
2. In the left sidebar, click **Build → Authentication → Get started**. Under
   **Sign-in method**, enable **Email/Password**.
3. Click **Build → Firestore Database → Create database**. Choose **Start in production
   mode** and pick any region close to you.
4. Once created, go to the **Rules** tab of Firestore and replace the contents with what's
   in `firestore.rules` in this project, then click **Publish**. This makes sure each
   account can only read and write its own data.
5. Go to the gear icon → **Project settings → General**, scroll to **Your apps**, click the
   `</>` (web) icon, register an app (any nickname), and copy the `firebaseConfig` object it
   shows you.
6. Open `src/firebase.js` in this project and paste your values over the placeholder
   `firebaseConfig` object (apiKey, authDomain, projectId, etc).

That's it — no server to run, Firebase's free tier easily covers an app like this.

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

## Syncing between phones

Open the app on each phone and sign in (or create an account the first time) with the
same email and password. Both phones then read and write the same Firestore document, so
any change — a new teacher, a logged session, a payment — appears on the other phone within
a second or two, as long as both have internet access. While offline, the app keeps working
off its local cache and syncs the next time it's back online.

## Notes

- App icons: replace `public/icon-192.png` and `public/icon-512.png` with your own 192×192 and 512×512 PNGs (any square logo works) before deploying, so the home-screen icon looks right. Placeholders are not included.
- Browser notifications (session reminders) only fire while the app tab/PWA is open in the foreground or backgrounded on some browsers — true background push would need a server component, which this app doesn't have.
- Keep `src/firebase.js`'s config values as they are once filled in — they identify your Firebase project, not a secret key; access is protected by the sign-in + Firestore rules, not by hiding this file.
