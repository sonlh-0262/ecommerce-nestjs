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
| Health         | @nestjs/terminus (Postgres + Redis)  |
| Realtime       | Socket.IO 4 (@nestjs/websockets)     |
| Tests          | Jest (unit) + Supertest (e2e)        |

## Requirements

- Docker Desktop, or Node.js >= 20 with a local PostgreSQL and Redis.

## Getting started

```bash
cp .env.example .env      # .env is gitignored, so create it once per clone
docker compose up -d --build
docker compose exec api npm run migration:run
docker compose exec api npm run seed
docker compose exec api npm run console -- seed:categories
docker compose exec api npm run console -- seed:products
```

Or, for a full data set to click through (users, orders in every status,
reviews), one command that also runs the three above:

```bash
docker compose exec api npm run console -- seed:demo
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
| GET    | `/attachments/:id`           | Mixed  | default                | Download a file: product images are public, avatars need a token |
| GET    | `/categories`                | Guest  | default                | List categories: `parentId` (`null` = roots), `isActive`, paging; cached |
| GET    | `/categories/:slug`          | Guest  | default                | One category with its parent and children      |
| GET    | `/products`                  | Guest  | default                | Search and filter published products           |
| GET    | `/products/featured`         | Guest  | default                | Featured products, best sellers first; cached  |
| GET    | `/products/:slug`            | Guest  | default                | One published product with images              |
| GET    | `/products/:slug/reviews`    | Guest  | default                | Reviews newest first, `rating` filter, star distribution |
| GET    | `/products/:slug/share`      | Guest  | default                | Share links (Facebook, X) and Open Graph fields of a published product |
| POST   | `/products/:slug/reviews`    | Bearer | default                | Review a product from one of my delivered orders, once |
| PATCH  | `/reviews/:id`               | Bearer | default                | Edit my review; the product average follows    |
| DELETE | `/reviews/:id`               | Bearer | default                | Delete my review, or any review as an admin    |
| GET    | `/cart`                      | Bearer | default                | My cart at current prices, unavailable items flagged |
| POST   | `/cart/items`                | Bearer | default                | Add a product; adds up with what is already there |
| PATCH  | `/cart/items/:itemId`        | Bearer | default                | Set the quantity of an item                    |
| DELETE | `/cart/items/:itemId`        | Bearer | default                | Remove an item                                 |
| DELETE | `/cart/items`                | Bearer | default                | Empty my cart                                  |
| POST   | `/orders`                    | Bearer | default                | Order the whole cart: PENDING, stock taken, mail sent |
| GET    | `/orders`                    | Bearer | default                | My orders: `status`, `from`, `to`, paging      |
| GET    | `/orders/:code`              | Bearer | default                | One of my orders with items and history        |
| POST   | `/orders/:code/payment`      | Bearer | default                | Declare a bank transfer (mock payment)         |
| POST   | `/orders/:code/cancel`       | Bearer | default                | Cancel a PENDING order, stock goes back        |
| POST   | `/product-suggestions`       | Bearer | 10 / hour / token      | Suggest a product; at most 5 waiting for review |
| GET    | `/product-suggestions`       | Bearer | default                | My suggestions with the admin decision         |
| GET    | `/chat/conversations`        | Bearer | default                | My conversation with the shop (opened on first call); every active one for an admin |
| GET    | `/chat/conversations/:id/messages` | Bearer | default          | Messages newest first, `before` cursor + `limit` (default 50) |
| POST   | `/chat/conversations/:id/messages` | Bearer | 30 / min / token | Send a message; pushed live as `message:new` |
| POST   | `/chat/conversations/:id/read` | Bearer | default              | Mark the other side's messages as read        |
| GET    | `/admin/users`               | Admin  | default                | List accounts: `q`, `status`, `role`, paging   |
| GET    | `/admin/users/:id`           | Admin  | default                | One account + orders count / spent / last      |
| PATCH  | `/admin/users/:id/status`    | Admin  | default                | Lock (`INACTIVE`) or unlock (`ACTIVE`)         |
| GET    | `/admin/orders`              | Admin  | default                | Every order: `status`, `code` prefix, `userId`, `from`, `to`, paging |
| GET    | `/admin/orders/:code`        | Admin  | default                | One order with its customer and who changed it |
| PATCH  | `/admin/orders/:code/status` | Admin  | default                | Confirm, ship, deliver or reject (with a reason) |
| POST   | `/admin/categories`          | Admin  | default                | Create a category (two levels at most)         |
| PATCH  | `/admin/categories/:id`      | Admin  | default                | Rename, move or hide a category                |
| DELETE | `/admin/categories/:id`      | Admin  | default                | Delete an empty category                       |
| GET    | `/admin/products`            | Admin  | default                | Products in any status, `includeDeleted`       |
| POST   | `/admin/products`            | Admin  | default                | Create a draft product                         |
| PATCH  | `/admin/products/:id`        | Admin  | default                | Update or publish (needs an image)             |
| DELETE | `/admin/products/:id`        | Admin  | default                | Soft delete: ARCHIVED, removed from carts      |
| POST   | `/admin/products/:id/images` | Admin  | default                | Upload 1-5 images (multipart `files`)          |
| DELETE | `/admin/products/:id/images/:imageId` | Admin | default        | Delete an image; the next becomes thumbnail    |
| GET    | `/admin/product-suggestions` | Admin  | default                | Every suggestion with its author: `status`, paging |
| PATCH  | `/admin/product-suggestions/:id` | Admin | default            | Approve, or reject with a note, once           |
| GET    | `/admin/stats/overview`      | Admin  | default                | Revenue, orders by status, products, customers over `from`-`to`; cached 5 min |
| GET    | `/admin/stats/best-sellers`  | Admin  | default                | Products by units delivered, deleted ones included |
| GET    | `/admin/stats/revenue`       | Admin  | default                | Revenue per month (`groupBy=month`) or year, empty periods at 0 |
| GET    | `/health`                    | Guest  | none                   | Pings Postgres + Redis; 503 when one is down   |
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
`avatarUrl` points at `GET /attachments/:id`, which needs a token for an
avatar but not for a product image.

### Catalog

```bash
curl 'http://localhost:3001/api/v1/products?q=ao%20thun&category=thoi-trang-nam&sort=price_asc'
curl -X POST http://localhost:3001/api/v1/admin/products/$ID/images   -H "Authorization: Bearer $TOKEN" -F 'files=@front.png' -F 'files=@back.png' -F 'isThumbnail=true'
```

`q` is a full-text search that ignores accents. Prices are whole VND and the
price filters compare the sale price when there is one. Slugs come from the
name and never change on rename. `GET /categories` and `GET /products/featured`
are cached in Redis for five minutes; every admin write bumps a generation
counter so the next read misses. When Redis is down both are served straight
from the database.

### Orders and reviews

```bash
curl -X PATCH http://localhost:3001/api/v1/admin/orders/ORD-20261015-0001/status   -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json'   -d '{"order":{"status":"REJECTED","reason":"Outside our delivery area"}}'
curl -X POST http://localhost:3001/api/v1/products/ao-thun/reviews   -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json'   -d '{"review":{"rating":5,"content":"Vai mat, mac vua nguoi."}}'
```

An order moves `PENDING -> CONFIRMED -> SHIPPING -> DELIVERED`; from `PENDING`
the admin can also reject it (a reason of 10+ characters is required) and the
customer can cancel it. Every other move, including setting the current status
again, answers `422`. Rejecting or cancelling puts the stock back, delivering
stamps `deliveredAt` and marks a cash-on-delivery order paid, and the customer
is emailed on `CONFIRMED` and `REJECTED`. The table lives in
`src/orders/order-status.machine.ts`.

A review needs a `DELIVERED` order of mine containing the product (`403`
otherwise) and is unique per product and account (`409`). `averageRating` and
`reviewCount` on the product are recomputed from the reviews in the same
transaction as every create, star change and delete.

### Statistics and scheduled jobs

```bash
curl 'http://localhost:3001/api/v1/admin/stats/overview?from=2026-01-01T00:00:00%2B07:00&to=2027-01-01T00:00:00%2B07:00' -H "Authorization: Bearer $ADMIN_TOKEN"
curl 'http://localhost:3001/api/v1/admin/stats/revenue?groupBy=month&year=2026' -H "Authorization: Bearer $ADMIN_TOKEN"
docker compose exec api npm run console -- job:run monthly-revenue-report
docker compose exec api npm run console -- job:run orders-auto-cancel
```

Revenue only counts `DELIVERED` orders, by the day they were delivered, in the
`APP_TIMEZONE` zone. Ranges are `[from, to)`: `to` is excluded, and both
default to the twelve months before now. `revenue` lists every period of the
window, empty ones at `0`.

Two jobs run on `@nestjs/schedule`:

| Job | When | What |
| --- | --- | --- |
| `monthly-revenue-report` | 00:00 on the 1st, `APP_TIMEZONE` | Emails every active admin the month that ended against the month before, with the top 5 |
| `orders-auto-cancel` | every hour | Cancels `PENDING` unpaid orders older than `ORDER_AUTO_CANCEL_DAYS`, puts the stock back, emails the customer (100 per run) |

Each instance runs them, so Redis decides who does the work: `SET lock:<job>
NX EX`, released by a Lua compare-and-delete. The monthly report also claims
`lock:monthly-revenue-report:<yyyy-mm>` for a day, so an instance ticking a
moment later does not send it twice. When Redis cannot be reached the run is
skipped and logged; `job:run` sends it by hand under the same lock.

### Chat

Each customer has one conversation with the shop, opened by their first
`GET /chat/conversations`; every admin can read and answer any of them.
History pages by cursor: pass the `createdAt` of the oldest message shown as
`before`. A message never shares its instant with another one of the same
conversation, so a page never skips or repeats one.

Live messages go through the Socket.IO namespace `/chat` on the API port:

```js
const socket = io('http://localhost:3001/chat', {
  auth: { token: accessToken },
  extraHeaders: { 'x-lang': 'vi' },
});
socket.on('message:new', ({ message }) => render(message));
socket.on('error', ({ code, message }) => warn(code, message));
const { message } = await socket.emitWithAck('message:send', {
  conversationId,
  content: 'Xin chào shop',
});
```

| Direction | Event | Payload |
| --- | --- | --- |
| client -> server | `message:send` | `{ conversationId, content }`; the ack is `{ message }`, 30 per minute per account |
| server -> client | `message:new` | `{ message }`, to the customer and to every admin, also for messages sent over REST |
| server -> client | `error` | `{ code, message }`, `code` being the HTTP status name (`BAD_REQUEST`, `NOT_FOUND`, `TOO_MANY_REQUESTS`...) |

A missing, invalid, expired or revoked token fails the handshake with a
`connect_error` whose `data` is `{ code, message }`. Every event checks the
token again, so a token logged out or an account locked since the handshake
gets `UNAUTHORIZED` / `FORBIDDEN` and the socket is closed; it is also closed
when the token expires. Messages are in the language of the handshake
(`x-lang`, `Accept-Language`, or `?lang=` in the connection URL).

Rooms live in the memory of one process. Running several API instances needs
the Socket.IO Redis adapter (`@socket.io/redis-adapter`) so a message sent on
one instance reaches sockets held by another; that is out of scope here.

### Health

```bash
curl http://localhost:3001/health
curl 'http://localhost:3001/health?lang=vi'
```

`@nestjs/terminus` pings PostgreSQL (`SELECT 1`) and Redis (`PING`), each with a
1.5 s timeout, so a dead dependency answers `503` instead of hanging the probe.
The body has the same shape either way, with `details` naming the component
that is down. Why it is down goes to the log, not to this public response.

## Seeding

Seeders are `nest-commander` commands: `npm run console -- <command>`
(`npm run console:prod -- <command>` from a production build). Every one of them
can be re-run: what already exists is skipped, and an existing admin keeps its
password. A failing command exits with code 1.

| Command           | Creates                                                         |
| ----------------- | --------------------------------------------------------------- |
| `seed:admin`      | The admin account (`npm run seed` is an alias)                  |
| `seed:categories` | 8 root categories with 2-3 sub-categories each                  |
| `seed:products`   | 50 products with placeholder images, 40 published, 10 featured |
| `seed:demo`       | All of the above, then 5 users, 20 orders and 30 reviews        |

`seed:admin` uses `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` when set; with
`NODE_ENV=production` it refuses to run without them, because the default
password is published. `seed:products` and `seed:demo` refuse production
altogether.

`seed:demo` goes through the real services (cart, checkout, payment, the
status machine, reviews), so it doubles as a check of the business rules. It
leaves 5 draft and 5 archived products, 4 active users and 1 pending one, 20
orders across all six statuses and 30 reviews on delivered products. Delivered
orders are moved back across the last 12 months - the only rows written
directly - so revenue statistics have more than one month to show. A fixed
random seed makes every run produce the same data, and a second run changes
nothing. `--fresh` empties every table, the cache and the upload directory
first. Demo checkouts queue real order mails, which land in Mailpit.

| Email               | Username | Role  | Password       |
| ------------------- | -------- | ----- | -------------- |
| `admin@example.com` | admin    | ADMIN | `Password@123` |
| `demo.user1@example.com` ... `demo.user4@example.com` | demo_user_1 ... 4 | USER | `Password@123` |
| `demo.user5@example.com` | demo_user_5 | USER (PENDING) | `Password@123` |

## Mail

Feature code queues mail with `MailQueueService.enqueue()` after its
transaction commits, and a BullMQ worker renders the Handlebars template and
sends it. Jobs retry three times with exponential backoff. The language is
captured from the request that queued the job, Vietnamese when there is none.
Templates live in `src/mail/templates/`; every string they print comes from
`src/i18n/*/mail.json`. Mails sent today: account activation, password reset,
order placed, and order confirmed or rejected (with the reason).

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

Beside one spec per module, three suites follow a user across modules:
`journey-account` (register to password reset), `journey-purchase` (cart to
review, plus a rejected order) and `authorization` - a guest / user / admin
matrix over every route the app registers, which fails when a new route is
added without a row. `query-count` proves the list endpoints are free of N+1
by comparing the queries run for 5 and 50 rows, and checks the cache.

`npm run test:cov` fails under 80% statements for any `*.service.ts`, 90% for
any guard, filter or state machine, and 60% for the remaining files. Jest
counts that last bucket without the files the first two rules cover; the
whole-project figure is about 78%.

## Debugging

`.vscode/launch.json` ships five configurations:

| Configuration | Use it with |
| --- | --- |
| Attach: local API (9229) | `npm run start:debug` on the host |
| Attach: Docker API (9230) | the API container started in debug mode (below) |
| Debug Jest: current file | the unit spec open in the editor |
| Debug Jest: current e2e file | the e2e spec open in the editor (stack must be up) |
| Debug console command | pick a seeder from the list |

The container runs `start:dev` by default, without an inspector. To debug it:

```bash
docker compose stop api
docker compose run --rm --service-ports api npm run start:debug
```

then start **Attach: Docker API (9230)**, set a breakpoint and call the route.
`docker compose up -d api` goes back to the normal container.

SQL is logged with `DB_LOGGING=true`. Independently of it, any query slower
than `DB_SLOW_QUERY_MS` (default 500 ms, `0` turns it off) is logged as a
warning. Each service logs through a `Logger` named after its class, so a
line says which class wrote it.

## Quality gates

```bash
npm run format:check
npm run lint       # eslint; prettier runs as a lint rule
npm run typecheck  # tsc --noEmit
npm test
npm run test:e2e
npm run build
```

## Environment

Every variable is listed with its default in `.env.example`, and validated at
startup by `src/config/env.validation.ts`. Those marked *prod* must be set when
`NODE_ENV=production`.

| Group | Variables |
| --- | --- |
| App | `NODE_ENV`, `PORT`, `APP_NAME`, `API_PREFIX`, `SWAGGER_PATH`, `SWAGGER_ENABLED`, `FALLBACK_LANGUAGE` |
| Database | `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SCHEMA`, `DB_SSL`, `DB_LOGGING`, `DB_SLOW_QUERY_MS` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_KEY_PREFIX` |
| Auth | `JWT_SECRET` (*prod*), `JWT_EXPIRES_IN`, `JWT_ISSUER`, `BCRYPT_SALT_ROUNDS` |
| Rate limit | `THROTTLE_TTL`, `THROTTLE_LIMIT` |
| Mail | `MAIL_HOST` (*prod*), `MAIL_PORT` (*prod*), `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` (*prod*), `MAIL_FROM_NAME`, `APP_WEB_URL` (*prod*) |
| Links / time | `APP_API_URL` (*prod*, origin used for share images), `APP_TIMEZONE` (IANA name, default `Asia/Ho_Chi_Minh`) |
| Files / orders | `STORAGE_ROOT`, `SHIPPING_FEE`, `ORDER_AUTO_CANCEL_DAYS` |
| Seeding | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` |
| Docker host ports | `API_HOST_PORT`, `DEBUG_HOST_PORT`, `DB_HOST_PORT`, `REDIS_HOST_PORT`, `MAILPIT_SMTP_HOST_PORT`, `MAILPIT_UI_HOST_PORT` |

## Layout

```
src/
  attachments/  uploads: validation, local storage, download endpoint
  auth/         register, verify, login, logout, password reset, JWT guard
  users/        profile, avatar, admin user management, one-time tokens
  categories/   category tree: public read, admin CRUD
  products/     product search, admin CRUD, product images
  cart/         the shopping cart
  orders/       checkout, order history, status machine, admin order management
  reviews/      product reviews and the rating aggregate
  chat/         customer <-> admin chat: REST history and the /chat gateway
  cache/        Redis cache with generation-based invalidation
  health/       terminus health check of Postgres and Redis
  console/      nest-commander commands and the seeders behind them
  mail/         BullMQ queue and worker, Handlebars templates
  common/       error filters, roles guard, decorators, throttling, pagination,
                socket auth / language / error helpers
  config/       typed config namespaces, env validation, app + swagger setup
  database/     TypeORM data source, transaction hooks, migrations, seeders
  redis/        shared ioredis client
  i18n/         translation catalogues
  main.ts       bootstrap
test/
  support/      e2e harness: app bootstrap, store guards, factories
```
