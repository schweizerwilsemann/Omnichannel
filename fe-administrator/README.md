# Omnichannel Frontend

React admin console for the QR-first restaurant ordering system. Follows the Rasops structure: Redux Toolkit + Redux Saga-ready store, axios service layer, Formik/Yup forms, and CRA build tooling.

## Environment

Create `.env` from `.env.example` and adjust:

```ini
REACT_APP_BASE_URL=http://localhost:3301/api/v1
REACT_APP_CRYPTO_SECRET_KEY=mysecretkey
```

`REACT_APP_BASE_URL` should point at the backend Express URL (matching `PORT` in `be/.env`).

## Getting Started

```bash
npm install
npm start
```

The app exposes routes for admin authentication flows:

- `/login` — owner/manager sign-in (calls `POST /admin/auth/login`).
- `/invitation` — invitation acceptance with `tokenIdentifier` + `token` query params (calls `POST /admin/auth/invitations/accept`).
- `/password-reset` & `/password-reset/confirm` — password recovery sequence.
- Authenticated area (`/dashboard`, `/orders`) uses an axios interceptor that refreshes tokens through `POST /admin/auth/refresh` and revokes sessions via `/admin/auth/logout`.

Axios automatically attaches bearer tokens from localStorage; failed refresh cascades into a Redux logout and navigation back to `/login`.

To expand beyond the auth flows, add services under `src/services/` (e.g. menu, guest orders) and render them inside `src/pages/` components. The `Orders` view already calls `GET /orders` and expects enriched order payloads (restaurant, table, totals) as exposed by the backend when those routes are implemented.
