# Time X site (/new)

Astro source for the marketing page at `timexchange.co.za/new/`. The built files are written to `../new/`, which GitHub Pages serves as-is, so the built output is committed.

## Commands

    cd site
    npm install
    npm run dev       # local preview
    npm run build     # writes ../new/

## Data

- `src/lib/catalog.ts` fetches `GET /public/catalog` from TBServer at build time (default: the production API; override with `PUBLIC_API_BASE`).
- If the API is unreachable, the build uses `src/data/catalog.fallback.json`. Refresh that file from the server's catalogue when services change.
- Services are edited in the Firestore collection `serviceCatalog`. Seed or re-seed with `python TBServer/scripts/seed_service_catalog.py`.
- Exchange status wording comes from the same endpoint (`statuses`).

## Deploying

Commit the built `../new/` folder along with the source. To publish live catalogue data, run `npm run build` once the server's `/public/catalog` is deployed, then commit `new/`.
