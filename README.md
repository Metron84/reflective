# The Reflective Football

Website for [thereflectivefootball.com](https://thereflectivefootball.com) — fan-first football documentary network.

## Beautiful Archive

Curated library of football in books, film, photography, music and art.

- Content: `content/archive/`
- Maintenance cadence and standing rules: [docs/archive-maintenance.md](docs/archive-maintenance.md)
- Launch bar: public scale features that wait for ~100 published entries use `isArchiveLaunchReady()` in `lib/archive/launch.ts`. Sitemap, JSON-LD, canonical URLs and OG cards ship ungated.

## Dev

```bash
npm install
npm run dev   # http://localhost:4343
```

See `CLAUDE.md` and `docs/TRF_Website_v1_Build_Spec.md` for project law and build order.
