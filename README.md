# E-commerce API

Backend API for the mock e-commerce project, built with NestJS, TypeORM and
PostgreSQL.

## Stack

| Concern        | Choice                               |
| -------------- | ------------------------------------ |
| Framework      | NestJS 11                            |
| Database       | PostgreSQL 16 + TypeORM (migrations) |
| Cache / tokens | Redis 7 (ioredis)                    |
| Auth           | JWT (passport-jwt) + bcrypt          |
| Validation     | class-validator + Joi (env)          |
| i18n           | nestjs-i18n (`en`, `vi`)             |
| API docs       | Swagger / OpenAPI at `/docs`         |
| Tests          | Jest (unit) + Supertest (e2e)        |

## Requirements

- Docker Desktop, or Node.js >= 20 with a local PostgreSQL and Redis.

## Getting started

```bash
cp .env.example .env      # .env is gitignored, so create it once per clone
docker compose up -d --build
docker compose exec api npm run migration:run
docker compose exec api npm run seed
```

The stack publishes its host ports off the defaults so it can run beside the
tutorial project:

| Service    | In-container | Host |
| ---------- | ------------ | ---- |
| API        | 3000         | 3001 |
| Debugger   | 9229         | 9230 |
| PostgreSQL | 5432         | 5433 |
| Redis      | 6379         | 6381 |

Change any of these with `API_HOST_PORT`, `DEBUG_HOST_PORT`, `DB_HOST_PORT`
and `REDIS_HOST_PORT` in `.env`.

- Swagger UI: <http://localhost:3001/docs>
- Health check: <http://localhost:3001/health>

### Running without Docker

```bash
npm install
# point DB_HOST/REDIS_HOST at localhost and fix the ports in .env first
npm run start:dev
```

## Endpoints

Base URL `/api/v1`. `/health` and `/docs` sit outside it on purpose: a probe
and the docs must not move when the API version does.

| Method | Path           | Auth   | Description                                      |
| ------ | -------------- | ------ | ------------------------------------------------ |
| POST   | `/auth/login`  | Guest  | Exchange a password for an access token          |
| POST   | `/auth/logout` | Bearer | Revoke the token used for the request            |
| GET    | `/health`      | Guest  | Liveness probe, localised message                |
| GET    | `/docs`        | Guest  | Swagger UI (`/docs-json` for the raw document)   |

### Log in

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"user":{"email":"son@example.com","password":"Password@123"}}'
```

```json
{
  "user": {
    "id": "17d7d310-f61a-4e0e-8afa-d340d5dacfff",
    "email": "son@example.com",
    "username": "sonlh",
    "fullName": "Lanh Hung Son",
    "phone": null,
    "address": null,
    "avatarUrl": null,
    "role": "USER",
    "status": "ACTIVE",
    "emailVerifiedAt": "2026-10-02T00:33:18.384Z",
    "createdAt": "2026-10-02T00:33:18.384Z",
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 86400
  }
}
```

Failures: `400` validation, `401` wrong email or password, `403` the account is
`PENDING` or `INACTIVE`. The `401` is deliberately identical for an unknown
email and a wrong password, and an unknown email still pays for one bcrypt
comparison, so the endpoint cannot be used to discover which addresses are
registered.

### Log out

```bash
curl -X POST http://localhost:3001/api/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

```json
{ "message": "You have been logged out" }
```

The token id (`jti`) goes onto a Redis denylist with the token's own remaining
lifetime as its TTL, so the list expires itself and needs no cleanup. Only that
one token is revoked - other sessions of the same account keep working.
Changing a password revokes them all at once instead, through
`users.password_changed_at`.

### Health

```bash
curl http://localhost:3001/health
curl 'http://localhost:3001/health?lang=vi'
```

## Seeded accounts

`npm run seed` is idempotent, so it can be re-run after `migration:reset`. It
refuses to run with `NODE_ENV=production`, because every seeded account shares
one published password.

| Email               | Username | Role  | Password       |
| ------------------- | -------- | ----- | -------------- |
| `admin@example.com` | admin    | ADMIN | `Password@123` |

## Migrations

Run these inside the API container, where `DB_HOST=postgres` resolves:

```bash
docker compose exec api npm run migration:generate -- src/database/migrations/CreateProducts
docker compose exec api npm run migration:run
docker compose exec api npm run migration:revert
docker compose exec api npm run migration:show
```

`synchronize` is off everywhere: the schema only ever changes through a
migration file, so development and production cannot drift apart. Migrations
are written by hand - `UQ_users_email` indexes `lower(email)` and all three
`users` indexes are partial (`WHERE deleted_at IS NULL`), which the entity
decorators cannot fully describe. `migration:generate` on a clean tree still
reports no changes, and that is the check to run after touching an entity.

## Tests

```bash
npm test          # unit
npm run test:cov  # unit + coverage
npm run test:e2e  # e2e, against the database named by .env.test
```

The e2e suite creates and migrates `ecommerce_test` on first run, and empties
every table between cases. It refuses to start unless `DB_DATABASE` ends in
`_test` and `REDIS_KEY_PREFIX` contains `test`, so it can never wipe a
development database. It reads `.env.test`, which points at the host ports, so
the Docker stack has to be up.

## Quality gates

```bash
npm run format:check
npm run lint       # eslint; prettier runs as a lint rule
npm run typecheck  # tsc --noEmit
npm test
npm run test:e2e
npm run build
```

## Layout

```
src/
  auth/         login, logout, JWT strategy, guard, token denylist
  users/        User entity, enums, lookups, password hashing
  common/       cross-cutting constants, shared DTOs, decorators, transforms
  config/       typed config namespaces, env validation, app + swagger setup
  database/     TypeORM data source, module, migrations, seeders
  redis/        shared ioredis client
  i18n/         translation catalogues
  main.ts       bootstrap
test/
  support/      e2e harness: app bootstrap, store guards, factories
```
