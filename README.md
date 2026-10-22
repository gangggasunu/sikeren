# Secure identity Worker

Cloudflare Worker for `https://tunnel.timemachine.id/secure` and `/secure/{ISO-3166-1-alpha-2}`.

- `/secure` returns an HTML sentence with the authenticated Cloudflare Access email, UTC timestamp, and the visitor's Cloudflare country code as a link.
- `/secure/{COUNTRY}` returns that country's SVG flag from a private R2 bucket with `Content-Type: image/svg+xml`.
- The Worker uses `ctx.access.getIdentity()` so the email comes from Cloudflare Access's authenticated context rather than a caller-controlled header.

## Prerequisites

- Node.js and npm on the deployment machine.
- Cloudflare account access for Workers and R2.
- A proxied DNS hostname `tunnel.timemachine.id` routed to the existing Cloudflare Tunnel.
- A Cloudflare Access application and allow policy covering `tunnel.timemachine.id/secure*`.

## Deploy with Wrangler

```bash
npm install
npx wrangler login
npx wrangler r2 bucket create secure-private-country-flags
npm run upload:flags
npx wrangler deploy
```

The flags are uploaded into the private bucket through Wrangler; do not enable the bucket's public `r2.dev` URL. The Worker accesses the bucket only through its `FLAGS` binding.

If the bucket already exists, skip the create command. To use another bucket name:

```bash
R2_BUCKET=your-private-bucket npm run upload:flags
```

Then update `bucket_name` in `wrangler.toml` to the same name.

## Access policy and route

Protect `tunnel.timemachine.id/secure*` in Cloudflare Zero Trust > Access > Applications. The allow policy should include the intended user and `@cloudflare.com` users from the lab requirement. This matches both `/secure` and `/secure/US`-style requests. `ctx.access` is required by the Worker; unauthenticated requests receive 401 even if Access is misconfigured.

Wrangler attaches the Worker to `tunnel.timemachine.id/secure*` using the route in `wrangler.toml`. It runs before the Tunnel origin for those paths; other paths on the hostname continue to the Tunnel.

## Test

After deploying and signing in through Access:

```bash
curl -i https://tunnel.timemachine.id/secure
```

The response should be `200` with `Content-Type: text/html; charset=utf-8`. Click the country code link; the flag response should have `Content-Type: image/svg+xml; charset=utf-8`.

An unauthenticated request should be redirected to Access or denied before the Worker response.

## Public Git repository

Initialize and push this directory to the public repository you choose:

```bash
git init
git add README.md package.json wrangler.toml src scripts
git commit -m "Add Access identity Worker backed by private R2 flags"
git branch -M main
git remote add origin <PUBLIC_REPOSITORY_URL>
git push -u origin main
```

Do not commit Cloudflare API tokens, `.dev.vars`, or R2 credentials. `wrangler login` uses the local authenticated Wrangler session.
