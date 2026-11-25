# Deploy Mahdu LMS to Vercel

## 1. Import the repository

Import the repository root in Vercel. Vercel will use `vercel.json`:

- `client/dist` is the static website.
- `api/[...path].ts` runs the Express API at `/api/*`.
- `/api/*` requests stay on the API; all other paths use the React SPA.

Do not set a separate `client` root directory.

## 2. Add environment variables

Configure these in **Vercel → Project → Settings → Environment Variables** for Production and Preview:

- `NODE_ENV=production`
- `DATABASE_URL` — Supabase pooled PostgreSQL connection string
- `DATABASE_SSL=true`
- `JWT_ACCESS_SECRET` — a newly generated secret of at least 32 characters
- `ACCESS_TOKEN_TTL=15m`
- `REFRESH_TOKEN_DAYS=7`
- `CLIENT_ORIGIN=https://your-domain.example` — exact deployed frontend origin, no trailing slash
- `STORAGE_DRIVER=supabase`
- `SUPABASE_URL=https://YOUR_PROJECT.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=...` — server-only, never expose it in `VITE_*` variables
- `SUPABASE_BUCKET=mahdu-files`
- `SCHOOL_NAME`, `SCHOOL_ADDRESS`, `SCHOOL_PHONE`, `SCHOOL_EMAIL`
- `SCHOOL_LOGO_PATH=client/public/mahdu.png`
- Optional: `RESEND_API_KEY`, `MAIL_FROM`, `PAYSTACK_SECRET_KEY`

Set `VITE_API_URL` only if the API is hosted on another origin. For this configuration, leave it empty so the website uses `/api` on the same Vercel domain.

Generate a JWT secret locally:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Never add real production secrets to `.env.example` or commit `.env`.

## 3. Prepare Supabase

1. Create the database and run migrations `001` through `019` in numeric order.
2. Create a **private** Supabase Storage bucket named `mahdu-files`.
3. Confirm the database pooler connection string is accessible from Vercel.
4. Keep the Supabase service-role key only in Vercel server environment variables.

## 4. Deploy and verify

Deploy from Vercel, then check:

- `https://your-domain.example/`
- `https://your-domain.example/api/health`
- Sign-in, refresh, and logout in a browser.
- Profile/avatar upload and download.
- PDF and ID-card generation.

The `/api/health` endpoint requires a working database connection.

## 5. Custom domain

Assign the custom domain in Vercel, update `CLIENT_ORIGIN` to the exact final HTTPS origin, redeploy, and configure DNS only after the domain is assigned.

For `www` and apex-domain redirects, set `CLIENT_ORIGIN` to the final canonical domain users will see.
