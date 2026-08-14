# Hierarchy Class — Documentation

Everything you need to understand, run, and extend the Hierarchy Class
platform. The docs are organized by concern so you can jump straight to what
you're working on.

| Document | What it covers |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | The big picture: stack, folder layout, runtime layers, and how the pieces talk to each other |
| [DATABASE.md](./DATABASE.md) | Schema, tables, RLS model, and the full migration index |
| [BACKEND.md](./BACKEND.md) | The actual backend: how Supabase (Postgres/RLS/RPC/realtime/storage) + Next.js server code are wired together |
| [API.md](./API.md) | HTTP/API surface: Next.js routes, Supabase RPCs, and realtime channels |
| [SECURITY.md](./SECURITY.md) | Auth flow, middleware, RLS policies, and defense-in-depth |
| [FRONTEND.md](./FRONTEND.md) | Pages, components, data stores/hooks, theming, and key user flows |

Also see:

- [`../database/README.md`](../database/README.md) — how to apply migrations
- [`../README.md`](../README.md) — project overview (what it is and who it's for)
