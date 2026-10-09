# E-commerce API

Backend API for the mock e-commerce project, built with NestJS, TypeORM and
PostgreSQL.

## Stack

| Concern        | Choice                               |
| -------------- | ------------------------------------ |
| Framework      | NestJS 11                            |
| Database       | PostgreSQL 16 + TypeORM (migrations) |
| Cache / tokens | Redis 7 (ioredis)                    |
| Queue / mail   | BullMQ + nodemailer (Handlebars)     |
| Rate limiting  | @nestjs/throttler, counted in Redis  |
| Uploads        | multer (memory) + local disk         |
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
| Mailpit    | 1025 / 8025  | 1026 / 8025 |

Change any of these with `API_HOST_PORT`, `DEBUG_HOST_PORT`, `DB_HOST_PORT`,
`REDIS_HOST_PORT`, `MAILPIT_SMTP_HOST_PORT` and `MAILPIT_UI_HOST_PORT` in
`.env`.

- Swagger UI: <http://localhost:3001/docs>
- Health check: <http://localhost:3001/health>
- Mail sent by the app: <http://localhost:8025> (Mailpit - nothing leaves the
  machine)

After pulling a change that adds packages, rebuild the API image and renew its
`node_modules` volume, or the container keeps running the old dependencies:

```bash
docker compose up -d --build -V api
```

### Running without Docker

```bash
npm install
# point DB_HOST/REDIS_HOST at localhost and fix the ports in .env first
npm run start:dev
```

## Endpoints

Base URL `/api/v1`. `/health` and `/docs` sit outside it on purpose: a probe
and the docs must not move when the API version does.

| Method | Path                         | Auth   | Rate limit             | Description                                    |
| ------ | ---------------------------- | ------ | ---------------------- | ---------------------------------------------- |
| POST   | `/auth/register`             | Guest  | 5 / 10 min / IP        | Create a PENDING account, email the activation |
| POST   | `/auth/verify-email`         | Guest  | 10 / 10 min / IP       | Redeem the activation link                     |
| POST   | `/auth/resend-verification`  | Guest  | 3 / 15 min / IP+email  | Email a fresh activation link (always 200)     |
| POST   | `/auth/login`                | Guest  | 5 / 5 min / IP+email   | Exchange a password for an access token        |
| POST   | `/auth/logout`               | Bearer | default                | Revoke the token used for the request          |
| POST   | `/auth/forgot-password`      | Guest  | 3 / 15 min / IP+email  | Email a password reset link (always 200)       |
| POST   | `/auth/reset-password`       | Guest  | 5 / 15 min / IP        | Redeem the reset link, set a new password      |
| GET    | `/users/me`                  | Bearer | default                | My profile, with `avatarUrl`                   |
| PATCH  | `/users/me`                  | Bearer | default                | Change username / fullName / phone / address   |
| PUT    | `/users/me/password`         | Bearer | 5 / 15 min / token     | Change my password, revoking every token       |
| POST   | `/users/me/avatar`           | Bearer | 10 / hour / token      | Upload or replace my avatar (multipart `file`) |
| GET    | `/attachments/:id`           | Bearer | default                | Download a stored file                         |
| GET    | `/admin/users`               | Admin  | default                | List accounts: `q`, `status`, `role`, paging   |
| GET    | `/admin/users/:id`           | Admin  | default                | One account + orders count / spent / last      |
| PATCH  | `/admin/users/:id/status`    | Admin  | default                | Lock (`INACTIVE`) or unlock (`ACTIVE`)         |
| GET    | `/health`                    | Guest  | none                   | Liveness probe, localised message              |
| GET    | `/docs`                      | Guest  | -                      | Swagger UI (`/docs-json` for the raw document) |

Every route needs a bearer token unless it is marked `@Public()`: the JWT
guard is global, so a route that forgets to declare itself is closed rather
than open. Routes under `/admin` also carry `@Roles(UserRole.Admin)`, checked
by a second global guard; any other account gets `403`.

Lists take `limit` (1-100, default 20) and `offset` (default 0) and answer
`{ <resource>: [...], <resource>Count }`, where the count covers every match,
not just the page.

Routes without a limit of their own are capped at `THROTTLE_LIMIT` requests
per `THROTTLE_TTL` seconds per client (100 per 60 s by default). Counters live in Redis so the
limit holds across instances; if Redis is down the limit is skipped rather than
failing the request. Going over answers `429` with a `Retry-After` header.

### Errors

Every error, validation failures included, has one shape:

```json
{ "errors": { "body": ["Email or password is incorrect"] } }
```

Constraint violations that reach the global filter are mapped too: unique
`409`, foreign key and check `422`. Anything unexpected is a `500` whose body
says nothing about the cause - the stack goes to the log only.

### Register and activate

```bash
curl -X POST http://localhost:3001/api/v1/auth/register   -H 'Content-Type: application/json'   -d '{"user":{"email":"new@example.com","username":"new_user","password":"Secret123"}}'
```

The account starts `PENDING` and cannot log in (`403`). The activation mail
lands in Mailpit; its link is `APP_WEB_URL/verify-email?token=...`, and the
front end posts that token to `/auth/verify-email`. Tokens are single use,
stored as a SHA-256 hash, and expire after 24 hours (activation) or 30 minutes
(password reset). Requesting a new link retires the previous one.

### Reset a password

`/auth/forgot-password` always answers `200` with the same message, so it
cannot reveal which emails are registered. `/auth/reset-password` sets the new
password, stamps `password_changed_at` - which makes every token issued
before it fail with `401` - and activates the account if it was still
`PENDING`, since the link proves the address.

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
`PENDING` or `INACTIVE`, `429` too many attempts. The `401` is deliberately identical for an unknown
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

### Profile and avatar

```bash
TOKEN=...   # from /auth/login
curl -X PATCH http://localhost:3001/api/v1/users/me   -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json'   -d '{"user":{"fullName":"Son","phone":null}}'
curl -X POST http://localhost:3001/api/v1/users/me/avatar   -H "Authorization: Bearer $TOKEN" -F 'file=@me.png'
```

`PATCH` changes only the fields sent; `null` or a blank string clears an
optional field. An avatar must be a JPEG, PNG or WebP of at most 2 MB, checked
by its first bytes rather than the name or the declared type. It is stored under
`STORAGE_ROOT` (default `./storage`) as `yyyy/MM/<uuid>.<ext>` with a row in
`attachments`; replacing it deletes the old file once the transaction commits.
`avatarUrl` points at `GET /attachments/:id`, which needs a token.

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

## Mail

Feature code queues mail with `MailQueueService.enqueue()` after its
transaction commits, and a BullMQ worker renders the Handlebars template and
sends it. Jobs retry three times with exponential backoff. The language is
captured from the request that queued the job, Vietnamese when there is none.
Templates live in `src/mail/templates/`; every string they print comes from
`src/i18n/*/mail.json`.

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
the Docker stack has to be up. Uploaded files go to `./tmp/test-storage`, which
is deleted between cases. Mail is not sent from e2e: `MailQueueService` is
replaced by a recorder, so a case can read the token a mail would have carried.

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
  attachments/  uploads: validation, local storage, download endpoint
  auth/         register, verify, login, logout, password reset, JWT guard
  users/        profile, avatar, admin user management, one-time tokens
  mail/         BullMQ queue and worker, Handlebars templates
  common/       error filter, roles guard, decorators, throttling, pagination
  config/       typed config namespaces, env validation, app + swagger setup
  database/     TypeORM data source, transaction hooks, migrations, seeders
  redis/        shared ioredis client
  i18n/         translation catalogues
  main.ts       bootstrap
test/
  support/      e2e harness: app bootstrap, store guards, factories
```
