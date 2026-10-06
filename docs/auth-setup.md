# Turning on sign-in

Sign-in is optional and **off until configured**: without the settings below, the account button is hidden and ThaliSense runs fully on-device as before. Everything here uses Firebase's free **Spark** plan, which has no time limit.

Allow about 20 minutes. Steps 1–5 are in web consoles and need your own Google and Facebook logins.

## 1. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Create a project** → name it `thalisense`. Google Analytics isn't needed.
2. **Project settings → General → Your apps → Web (`</>`)** → nickname `ThaliSense web` → **Register app** (skip Firebase Hosting).
3. Copy the `firebaseConfig` values. You need `apiKey`, `authDomain`, `projectId` and `appId`. These are public identifiers, not secrets.

## 2. Switch on the sign-in methods

**Build → Authentication → Get started → Sign-in method**:

- **Email/Password**: enable it. Leave email-link off.
- **Google**: enable it and choose a support email. Nothing else to set up.
- **Facebook**: you need an App ID and secret from Meta:
  1. [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Create app** → *Authenticate and request data from users with Facebook Login*.
  2. **App settings → Basic**: copy the **App ID** and **App secret** into Firebase. Set:
     - Privacy policy URL: `https://thalisense.vercel.app/privacy.html`
     - User data deletion → instructions URL: `https://thalisense.vercel.app/privacy.html#delete`
     - App domains: `thalisense.vercel.app`
  3. **Facebook Login → Settings → Valid OAuth redirect URIs**: paste the redirect URI Firebase shows on the Facebook provider screen. It looks like `https://<project-id>.firebaseapp.com/__/auth/handler`.
  4. Switch the app from **Development** to **Live** so anyone can sign in. `email` and `public_profile` need no app review.
- **Apple**: leave this for later (see the last section).

## 3. Authorise the website

**Authentication → Settings → Authorized domains → Add domain** → `thalisense.vercel.app`.

## 4. Create the database

**Build → Firestore Database → Create database**:

- Location: **asia-south1 (Mumbai)**, closest to users in India for the lowest sync latency. This can't be changed later.
- Start in **production mode**.

Then open **Rules**, replace everything with the contents of [`firestore.rules`](../firestore.rules), and **Publish**. Users can then read and write only their own data; this is verified by `npm run test:rules`.

## 5. Point the app at it

Add the config to Vercel (Project → Settings → Environment Variables, Production), or send the four values to whoever maintains the deploy:

| Variable | Value from `firebaseConfig` |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |
| `VITE_AUTH_PROVIDERS` | `google,facebook` |

Redeploy. **Sign in** now appears in the sidebar (or the phone's bottom bar) and on the welcome screen.

## Later: Sign in with Apple

Apple requires a paid Apple Developer Program membership (US$99 a year). Once you have one:

1. In [developer.apple.com](https://developer.apple.com/account/resources): create an **App ID** with *Sign in with Apple*, then a **Services ID** (for example `app.thalisense.web`). Under its configuration, add the domain `<project-id>.firebaseapp.com` and the return URL `https://<project-id>.firebaseapp.com/__/auth/handler`.
2. Create a **Key** with *Sign in with Apple*, and download the `.p8` file.
3. In Firebase → Authentication → Sign-in method → **Apple**: enter the Services ID, Team ID, Key ID and private key.
4. Set `VITE_AUTH_PROVIDERS=google,facebook,apple` and redeploy. The Apple button is already built and tested; this only reveals it.

## How it works

- `src/lib/firebase.ts` loads the Firebase SDK lazily, so it is **not** part of the first page load. It loads when someone opens the sign-in sheet, or in the background for a returning signed-in user.
- Data syncs through **Firestore Lite**: plain HTTPS requests, much smaller than the full SDK. It is local-first: the app always reads from the device, pulls on sign-in and when you come back to the tab, and pushes only the months that changed, about a second after each edit.
- `npm run e2e:auth` runs the sign-in and sync tests (email, Google, Facebook, Apple, two-device sync, deletions, account deletion, accessibility) against the local Firebase emulators. No real project is needed.
