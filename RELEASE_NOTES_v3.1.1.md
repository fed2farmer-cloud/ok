# SecuredLanding v3.1.1 — Android Login and Admin Routing Repair

## Fixed

- Prevented blocked browser storage from stopping sign-in in Android in-app browsers.
- Replaced direct `sessionStorage` access with guarded optional `localStorage` access.
- Guarded existing-session restoration so a storage restriction cannot crash the login screen.
- Added the missing `/admin-dashboard` route used by role-based login redirects.
- Retained `/admin` as an alternate admin URL.

## Verified

- `npm run build` completes successfully with Vite.

## Deploy

Upload the contents of this folder to the root of the GitHub repository and deploy the `main` branch in Vercel.
