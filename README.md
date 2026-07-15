# Huddle

A full-stack chat and video conferencing platform — 1:1 and group chat, 1:1 and group video
(WebRTC/mediasoup), Teams-style standalone conferencing with lobby approval, subscription
billing via Stripe, and OAuth + email authentication. Built as a portfolio project
demonstrating backend architecture (DDD + modular monolith, designed for future microservice
extraction), TDD, and production-grade tooling.

## Tech Stack

- **Backend:** NestJS 11, TypeScript 6
- **Frontend:** Next.js 16, React 19, TailwindCSS
- **Databases:** PostgreSQL 17 (Prisma), MongoDB 8 (Mongoose), Redis 7.4 (ioredis)
- **Real-time:** Socket.io, mediasoup (WebRTC SFU)
- **Payments:** Stripe
- **Infra:** Docker Compose, pnpm workspaces, GitHub Actions CI

## Getting Started

```bash
git clone <repo-url>
cd huddle
pnpm install
cp .env.example .env   # adjust *_HOST_PORT variables if defaults conflict locally
docker-compose up -d
pnpm dev
```

- API: http://localhost:4000
- Web: http://localhost:3000

## Architecture & Design Notes

Detailed design decisions, DDD architecture, and implementation notes are tracked in
[`docs/`](./docs) — written as working documentation through active development, not a
polished reference (see Phase 6 for a planned cleanup pass).

## Status

🚧 Phase 0 (project scaffold) complete. Phase 1 (Identity) in progress.
