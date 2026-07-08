# Auth — implementation plan (Firebase + backend access_token)

Roadmap item **2. Auth** — "Implement login/logout feature with auth API".
Port the auth pattern from **`G:\Develop\xno-builder`**, adapt to this project's stack: **shadcn/ui (Radix new-york) + react-hook-form + zod + TanStack Query + Zustand**, and the existing `lib/api-client.ts` / `store/auth-store.ts` / `lib/constant.ts`.

**Do NOT bump the Next.js major.** This is an existing Next 16 project.

---

## 0. TL;DR of the flow

```
Login:  email+password ──signInWithEmailAndPassword──▶ Firebase
        Firebase ──getIdToken()──▶ firebaseJWT
        GET /auth/v1/auth/token  (Authorization: Bearer <firebaseJWT>)
             └─▶ { access_token, refresh_token, session_token, session_secret, user }
        store { user, accessToken } in zustand  →  redirect "/"

Every API call:  Authorization: Bearer <access_token>   (the backend xq_ token, NOT the firebaseJWT)

Logout: DELETE /auth/v1/auth/revoke (Bearer access_token, best-effort) → signOut(firebase) → clear store → redirect "/login"
```

`access_token` is the **backend `xq_` token** and is the Bearer for **all other APIs** (HFT/XALPHA/etc.). The Firebase JWT is used **only** on the `GET /auth/token` exchange call.

---

## 1. What xno-builder does (verified — reference these files)

| Concern | xno-builder location | Pattern |
|---|---|---|
| Firebase init | `G:\Develop\xno-builder\lib\firebase.ts` | `initializeApp` (guarded by `getApps().length`) + `getAuth`; config **hardcoded** (no env). |
| Providers | **email/password only** | `signInWithEmailAndPassword` (`app\(auth-layout)\dang-nhap\page.tsx:209`). No Google/GitHub/social. |
| Login UI | `app\(auth-layout)\dang-nhap\page.tsx` | Formik+Yup+HeroUI. Fields: Email, Password (show/hide eye). Links: sign-up, forgot-password. |
| JWT→access_token exchange | `hooks\user\useUserAccessToken.tsx` | `GET ${AUTH_API_URL}/auth/token` with `Bearer <firebaseJWT>`; unwrap `res.json().data`. (SWR-cached, key `["userInfo", firebaseJWT]`.) |
| Token storage | `store\auth.ts` (zustand `persist`, key `"auth-storage"`) | Persists `{ user, accessToken: firebaseJWT, expiredAt }`. **Backend access_token is NOT persisted** — re-fetched via SWR on load. |
| Refresh | `store\auth.ts:32` (`onAuthStateChanged`) + `app\providers.tsx:18-35` | Decodes JWT `exp`; `getIdToken(isExpired)` force-refresh; a **6s `setInterval`** re-runs `initialize()` when expired. `refresh_token` field is returned but **never used**. |
| Route guard | `app\(dashboard)\layout.tsx:35-120` | Client-side: `if (!user?.emailVerified) router.replace("/dang-nhap")`; shows spinner while `loading`. **No `middleware.ts`.** |
| Attach token | `lib\api.ts` `fetcher(url, accessToken)` + `hooks\user\withAccessTokenSwrKey.ts` | Every data hook passes `access_token` → `fetcher` sets `Authorization: Bearer`. |
| Logout | `app\(dashboard)\_components\Header.tsx:90` | `signOut(getAuth())` only. (`DELETE /auth/revoke` is used **only** in the email-verify flow, not user logout.) |
| firebase dep | `firebase@^12.6.0` | Modular SDK (`firebase/app`, `firebase/auth`). No `react-firebase-hooks`. |

**We deliberately deviate from xno-builder in 3 places** (see §4 rationale): use **TanStack Query not SWR**, use **`onIdTokenChanged` not a 6s timer**, and **do NOT persist tokens** (Firebase already persists the session).

---

## 2. Firebase config (FOUND — same `xno-quant` project)

Hardcoded in `G:\Develop\xno-builder\lib\firebase.ts`. Reuse **verbatim** — the backend `/auth/token` validates Firebase JWTs minted by this exact project, so we must sign in against the same one.

```
apiKey:            AIzaSyD8AFSR1vg21WOwLNVhczWfWfi3YSmZ9NA
authDomain:        xno-quant.firebaseapp.com
projectId:         xno-quant
storageBucket:     xno-quant.firebasestorage.app
messagingSenderId: 188683570140
appId:             1:188683570140:web:cc43a99843e19ebef35d19
measurementId:     G-SPS07SGVBV   (Analytics — we will NOT init Analytics; admin tool doesn't need it)
```

These are **public web config** (safe to ship in client bundle). Put them in `NEXT_PUBLIC_FIREBASE_*` env vars for cleanliness; values above are the defaults.

**Caveat to surface:** Firebase Auth only allows sign-in from **Authorized domains** (Firebase console → Auth → Settings). `localhost` is allowed by default (dev on :3001 works). **The deployed admin-UI domain must be added to the xno-quant project's authorized domains** before prod login works — flag to user (§9).

---

## 3. Auth API endpoints (from `types/api/auth.ts`, base `https://api.dev.xnoquant.io/auth/v1`)

| Method | Path | Auth header | Returns |
|---|---|---|---|
| `GET` | `/auth/token` | `Bearer <firebaseJWT>` | `DefaultResponseModel & { data: TokenData }` — **exchange** |
| `DELETE` | `/auth/revoke` | `Bearer <access_token>` | `MessageResponse` — **logout/revoke** |
| `GET` | `/me` | `Bearer <access_token>` | `DefaultResponseModel & { data: User }` — **current user** |

`TokenData = { access_token, refresh_token, session_token, session_secret, user: User }`.
`User = { user_id, email, email_verified, firebase_uid, fullname, username, phone, picture, avatars, roles?: string[], info, ... }`.
All responses wrap the payload in `{ data, success, message, status_code }` — **unwrap `.data`**.

(Password-reset / verification-email / verify-email endpoints exist but are **out of scope** for Roadmap item 2 — login+logout only.)

---

## 4. Architecture decisions for THIS project (with rationale)

1. **Session source of truth = Firebase SDK.** Firebase persists auth in the browser (localStorage/IndexedDB) by default. On page load an `AuthProvider` re-derives our state from Firebase → no need to persist tokens ourselves.
2. **Do NOT persist tokens in zustand** (deviates from xno-builder's `persist`). Tokens are short-lived and re-mintable from the live Firebase session; persisting them adds a stale/secret-in-localStorage footgun for zero benefit. Store `{ user, accessToken, status }` **in memory only**.
3. **Refresh via `onIdTokenChanged`** (deviates from xno-builder's 6-second `setInterval`). Firebase fires `onIdTokenChanged` whenever it refreshes the ID token (~hourly) or on sign-in/out. On each fire: get fresh `firebaseJWT` → re-exchange for a new `access_token` → update store. Cleaner than a polling timer + manual `exp` decode. (Optional Phase-2 nicety: a 401-retry that force-refreshes + re-exchanges once.)
4. **Attach access_token centrally in `lib/api-client.ts`.** Change the `token` params to **default to `useAuthStore.getState().accessToken`**. This makes every existing hook (`apiGet(url)` with no token, e.g. `hooks/api/use-venues.ts`) automatically send the Bearer — **zero changes to existing data hooks**. Zustand `getState()` works outside React.
5. **Route protection = client-side guard** (matching xno-builder; middleware can't read the Firebase session since there's no auth cookie). A `<AuthGuard>` wraps `(dashboard)` children: spinner while `loading`, redirect to `/login` if unauthenticated.
6. **Login lives outside the `(dashboard)` group** so it has no sidebar/header chrome → new route group `app/(auth)/login`.
7. **Auth is independent of `USE_MOCK`.** `USE_MOCK=true` keeps all *data* mocked; auth (login gate) is real regardless. They compose fine: you log in, then see mock data. (Optional dev bypass — see §9 open question.)
8. **Providers = email/password only** (matching xno-builder + internal-admin context). Google/social is an open question (§9).
9. **UI = shadcn.** Build the login form with shadcn `Input`/`Label`/`Button` + a new shadcn `Form` primitive + `react-hook-form` + `zod` (all already installed except the `form.tsx` file). No new form-lib deps (no Formik/Yup).

---

## 5. Dependencies & env

**Add (1 runtime dep):**
```
firebase@^12.6.0      # match xno-builder; modular SDK
```
`npx shadcn@latest add form` — adds `components/ui/form.tsx` (no new runtime dep; `react-hook-form`, `@hookform/resolvers`, `zod` already in package.json). Do NOT install `react-firebase-hooks` / `firebase-admin` — not needed.

**Env vars** — add to `.env.local` (and create `.env.example` documenting them):
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyD8AFSR1vg21WOwLNVhczWfWfi3YSmZ9NA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xno-quant.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xno-quant
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xno-quant.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=188683570140
NEXT_PUBLIC_FIREBASE_APP_ID=1:188683570140:web:cc43a99843e19ebef35d19
```
(`NEXT_PUBLIC_BASE_URL` already set → `AUTH_API_URL` already resolves to `https://api.dev.xnoquant.io/auth/v1`.)

---

## 6. Files to create / modify

### Create
| File | Purpose |
|---|---|
| `lib/firebase.ts` | `initializeApp` (guarded) + `export const auth = getAuth(app)`. Config from `NEXT_PUBLIC_FIREBASE_*`. No Analytics. |
| `lib/auth-api.ts` | Low-level calls: `exchangeToken(firebaseJWT): Promise<TokenData>` (GET `/auth/token`), `revokeToken(accessToken)` (DELETE `/auth/revoke`), `fetchMe(accessToken): Promise<User>` (GET `/me`). Uses `AUTH_API_URL`, unwraps `.data`. Reuse types from `types/api/auth.ts`. |
| `components/auth/auth-provider.tsx` | `"use client"`. On mount: `onIdTokenChanged(auth, cb)`. `cb(firebaseUser)`: if user → `getIdToken()` → `exchangeToken` → set `{ user, accessToken, status:'authenticated' }`; else clear → `status:'unauthenticated'`. Renders `children`. Exposes nothing (state lives in the store). |
| `components/auth/auth-guard.tsx` | `"use client"`. Reads `status` from store. `loading` → centered spinner; `unauthenticated` → `router.replace("/login")` + render null; `authenticated` → `children`. |
| `app/(auth)/layout.tsx` | Minimal centered layout (dark bg, `<Logo/>`), no sidebar/header. |
| `app/(auth)/login/page.tsx` | `"use client"`. shadcn Form (rhf + zod: email, password). Submit → `useAuth().login()`. If already `authenticated` → `router.replace("/")`. Inline error on failure; loading state on Button. Optional show/hide password toggle (solar icon). |
| `components/ui/form.tsx` | shadcn `Form` primitive (via CLI). |
| `hooks/api/use-me.ts` | (optional) TanStack Query `useMe()` → `fetchMe(accessToken)`, `enabled: status==='authenticated'`. Header/profile can read from store instead, so this is optional. |

### Modify
| File | Change |
|---|---|
| `store/auth-store.ts` | **Rewrite** the mock. New shape: `{ user: User \| null; accessToken: string \| null; status: 'loading' \| 'authenticated' \| 'unauthenticated'; setSession(user, token); clear(); }`. In-memory only (no `persist`). `User` from `types/api/auth.ts` (`components["schemas"]["models.User"]`). Keep export name `useAuthStore`. |
| `hooks/use-auth.ts` | **Rewrite**. Expose `{ user, status, isAuthenticated, login(email, password), logout() }`. `login` = `signInWithEmailAndPassword` (the provider's `onIdTokenChanged` does the exchange + store fill). `logout` = best-effort `revokeToken(accessToken)` → `signOut(auth)` → `clear()`. Keep returning `user` so `header.tsx` keeps working. |
| `lib/api-client.ts` | Default the `token` arg of `apiGet/apiPost/apiDelete` to `useAuthStore.getState().accessToken`. (One-line change per fn; existing call sites unchanged.) |
| `app/providers.tsx` | Wrap `children` with `<AuthProvider>` (inside `QueryClientProvider`). |
| `app/(dashboard)/layout.tsx` | Wrap `{children}` (or the whole shell) with `<AuthGuard>`. |
| `components/layout/sidebar.tsx` | Wire the existing Logout `<button>` (lines 102-120) `onClick={() => logout()}` from `useAuth()`; make the component call `useAuth()` (already `"use client"`). |
| `components/layout/header.tsx` | Already `useAuth()`; map real `User` → display: `user.fullname \| user.username \| user.email` for name, `user.email` for subline. Avatar fallback = initial. |
| `lib/constant.ts` | (optional) add `firebaseConfig` object reading `NEXT_PUBLIC_FIREBASE_*`, or inline it in `lib/firebase.ts`. |
| `.env.local` + new `.env.example` | Add the `NEXT_PUBLIC_FIREBASE_*` vars (§5). |
| `package.json` | Add `firebase` (+ `components/ui/form.tsx` via shadcn CLI). |

---

## 7. Exact sequences

### 7.1 Login
1. User at `/login`; enters email + password; rhf+zod validates (email format, password non-empty).
2. Submit → `useAuth().login(email, password)` → `signInWithEmailAndPassword(auth, email, password)`.
3. Firebase authenticates + persists the session locally.
4. `onIdTokenChanged` (in `AuthProvider`) fires with the `firebaseUser` → `firebaseJWT = await firebaseUser.getIdToken()`.
5. `exchangeToken(firebaseJWT)` → `GET /auth/v1/auth/token` (`Bearer <firebaseJWT>`) → `TokenData`.
6. Store `setSession(TokenData.user, TokenData.access_token)`; `status = 'authenticated'`.
7. Login page effect sees `authenticated` → `router.replace("/")`. `AuthGuard` now renders the dashboard; all data hooks send `Bearer <access_token>` automatically.
8. **Errors:** wrong credentials → Firebase throws (`auth/invalid-credential`) → show inline message, no redirect. Exchange fails (non-200) → `signOut(auth)` + inline "Access denied / could not obtain session".

### 7.2 Logout
1. Sidebar Logout `onClick` → `useAuth().logout()`.
2. `revokeToken(accessToken)` → `DELETE /auth/v1/auth/revoke` (`Bearer <access_token>`), **best-effort** (ignore failure).
3. `signOut(auth)` (Firebase).
4. `onIdTokenChanged` fires with `null` → store `clear()`, `status = 'unauthenticated'`.
5. `router.replace("/login")` (from the logout handler or the guard).

### 7.3 Route protection / reload
1. `AuthProvider` mounts, initial `status = 'loading'`.
2. `onIdTokenChanged` resolves: Firebase session present → exchange → `authenticated`; absent → `unauthenticated`.
3. `AuthGuard`: `loading` → spinner; `unauthenticated` → `router.replace("/login")`; `authenticated` → render.
4. Login page: if `authenticated` → `router.replace("/")` (prevents showing login to a signed-in user).

---

## 8. Phased task breakdown (Sonnet implementers, disjoint file ownership)

> Phases 1 & 2 are the critical path and must precede 3-4. Files listed under one owner are **not touched by another** in the same phase.

### Phase 1 — Foundation (one Sonnet, sequential; unblocks everyone)
Owner-A:
- `package.json` → add `firebase`; run install. `npx shadcn@latest add form` → `components/ui/form.tsx`.
- `.env.local` + `.env.example` → `NEXT_PUBLIC_FIREBASE_*`.
- `lib/firebase.ts` (init + `export auth`).
- `lib/auth-api.ts` (`exchangeToken`, `revokeToken`, `fetchMe`, typed via `types/api/auth.ts`).
- `store/auth-store.ts` (rewrite to `{ user, accessToken, status, setSession, clear }`).
- **Verify:** `npm run build` / `npx tsc --noEmit` passes; store + auth-api typecheck against `types/api/auth.ts`.

### Phase 2 — Wiring (one Sonnet; depends on Phase 1)
Owner-B:
- `components/auth/auth-provider.tsx` (onIdTokenChanged → exchange → store).
- `components/auth/auth-guard.tsx`.
- `hooks/use-auth.ts` (rewrite: `login`/`logout`/`user`/`status`).
- `lib/api-client.ts` (default token from store).
- `app/providers.tsx` (mount `<AuthProvider>`).
- **Verify:** app boots; unauthenticated visit to `/` redirects to `/login`; token auto-attaches (inspect a network request in `USE_MOCK=false` path or unit-assert `apiGet` header).

### Phase 3 — Login UI (one Sonnet; depends on Phase 1's `form.tsx`, Phase 2's `use-auth`)
Owner-C:
- `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`.
- **Verify (browser, per CLAUDE.md §5 — Claude in Chrome):** load `/login`, submit a real dev credential, confirm redirect to `/` and `GET /auth/token` 200 in network tab; confirm wrong password shows inline error.

### Phase 4 — Dashboard wiring (one Sonnet; depends on Phase 2; disjoint from Phase 3 files)
Owner-D:
- `app/(dashboard)/layout.tsx` (wrap `<AuthGuard>`).
- `components/layout/sidebar.tsx` (Logout `onClick`).
- `components/layout/header.tsx` (real `User` → name/email/avatar).
- `hooks/api/use-me.ts` (optional).
- **Verify (browser):** logged-in header shows real user; Logout revokes + returns to `/login`; back-nav doesn't re-enter dashboard.

**Parallelism:** Phase 1 → Phase 2 are sequential. After Phase 2, **Phase 3 (Owner-C) and Phase 4 (Owner-D) run in parallel** — their file sets are disjoint (`app/(auth)/*` vs `app/(dashboard)/layout.tsx` + `components/layout/*`).

---

## 9. Figma / design status + open questions (SURFACE TO USER)

**Figma login design: NONE.** Searched the whole `XNO-QUANT-AI` file (`B7Hh2GpERHUPyy3Zdv35sY`) — zero frames named login / sign-in / sign-up / password / auth / forgot / credential. The referenced node `13962-19026` and the currently-selected node are **trading dashboards**, not auth.
→ **Blocker/decision:** either (a) user provides a login-screen Figma node, or (b) we design a login screen consistent with the existing dark theme (Be Vietnam Pro font, `ACTIVE_GRADIENT` green accent from `sidebar.tsx`, `<Logo/>`, existing color tokens `--background`/`--border`/`--muted-foreground`) and get sign-off. Recommend (b) with a centered card (Logo, email, password, Sign-in button) mirroring xno-builder's field set, unless the user has a design.

**Open questions:**
1. **Firebase creds for the team** — the web config is reused (public, in `.env.example`), but each dev needs a **valid Firebase account in the `xno-quant` project** to log in against dev. Is there a shared/test admin account, or should we add a dev bypass?
2. **Dev bypass?** Do you want a `NEXT_PUBLIC_AUTH_BYPASS=true` escape hatch that seeds a fake authenticated admin (skip Firebase) so mock-data work needs no login? Default: no bypass (real auth always). — decide.
3. **Providers** — email/password only (assumed), or also **Google** sign-in? xno-builder is email/password only.
4. **Access restriction** — should we gate on `User.roles` (e.g. require an "admin" role from `/me`) so any xno-quant Firebase user can't enter the internal admin? Or is a valid `/auth/token` exchange sufficient? xno-builder gates on `email_verified`; do we require that here?
5. **Deploy** — the production admin-UI domain must be added to the xno-quant Firebase **Authorized domains** before prod login works (localhost is fine for dev).

---

## 10. Verification checklist (definition of done)
- [ ] `npm run build` + `npx tsc --noEmit` clean.
- [ ] Unauthenticated → any `(dashboard)` route redirects to `/login`.
- [ ] Valid login → `GET /auth/token` 200 → redirect `/` → header shows real user.
- [ ] A data request (mock off) carries `Authorization: Bearer <access_token>`.
- [ ] Logout → `DELETE /auth/revoke` fired → back to `/login`; cannot re-enter via back button.
- [ ] Reload while logged in → stays authenticated (Firebase session), no flash into the app before guard resolves (spinner shown).
- [ ] Wrong password → inline error, no redirect.
- [ ] Browser-verified via Claude in Chrome (CLAUDE.md §5).
