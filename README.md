# OFCP Demo Shop

A look-alike demo shop showing how a sales channel integrates OFCP via the
[`@tecsafe/widget-sdk`](https://github.com/TECSAFE/widget-sdk):
a real server-to-server two-step token exchange, guest vs. logged-in sessions that
carry over on login, and a cookie-banner-style consent flow that gates the
whole widget lifecycle. Everything else in this repo (product listing, cart
math, i18n, branding, ...) is generic shop scaffolding that exists only to
give the OFCP pieces somewhere to live.

## Layout

- `api/` — NestJS demo backend. JSON file store (no database), cookie
  sessions, register/login, per-user consent storage, session cart, and the
  server-to-server TECSAFE token exchange.
- `ui/` — Nuxt 4 demo shop. Product listing/detail/cart, login/register,
  consent banner, and the widget SDK embed.

## How this demo implements OFCP

Three pieces work together: the API performs the actual protocol exchange,
the consent flow decides *whether* the widget is even allowed to run, and
the widget SDK composable wires the shop's data into TECSAFE's iframe.

### 1. Server-to-server token exchange

[`TecsafeService`](api/src/tecsafe/tecsafe.service.ts) implements OFCP's
two-step JWT exchange, called from
[`POST /tecsafe/token`](api/src/tecsafe/tecsafe.controller.ts):

1. [`getSaleschannelToken()`](api/src/tecsafe/tecsafe.service.ts#L22-L56) —
   exchanges the shop's static `OFCP_SALESCHANNEL_API_KEY` for a
   saleschannel-level JWT (`POST /v1/auth/jwt/saleschannel`). This token is
   cached in memory until ~60s before its `expires_in`, so it isn't
   re-fetched on every request.
2. [`exchangeCustomerToken()`](api/src/tecsafe/tecsafe.service.ts#L58-L96) —
   exchanges that saleschannel JWT for a customer-scoped JWT
   (`POST /v1/auth/jwt/saleschannel-customer`), the one the widget SDK
   actually uses. For a guest this carries no `customerPayload`; for a
   logged-in shopper it carries `{ saleschannelCustomerID,
   saleschannelCustomerEmail }` taken from the shop's own session
   ([`tecsafe.controller.ts:17-25`](api/src/tecsafe/tecsafe.controller.ts#L17-L25)).
   The widget SDK's previous token is always forwarded as
   `previousSaleschannelCustomerJwt` so TECSAFE merges guest assets
   (configurations, cart) into the account on login and starts a clean guest
   session on logout.

Configuration lives in
[`ConfigService`](api/src/shared/config/config.service.ts): `OFCP_GATEWAY_URL`
(the api-gateway to talk to), `OFCP_SALESCHANNEL_API_KEY`,
and `GUEST_SESSION_TTL_DAYS`, which is dual-purpose:
it also becomes the `guestSessionTTL` sent in the exchange body.

### 2. Consent gates the widget, not just a cookie banner

Data exchange with TECSAFE is opt-in and the SDK is never instantiated
without it. The rule set:

- **Guests** keep their choice only in `localStorage`
  ([`demo-shop-consent`](ui/app/utils/consent.ts)) — nothing is sent to
  TECSAFE or the shop's own backend until consent is granted.
- **Registering** sends the guest's current browser consent along, so it
  becomes the new account's stored consent
  ([`RegisterDto.consent`](api/src/auth/auth.dto.ts#L23-L34) →
  [`UsersService.register`](api/src/users/users.service.ts)).
- **Logging in** restores the account's server-side consent and overwrites
  whatever was chosen locally — the account wins
  ([`reconcileConsentOnLogin`](ui/app/utils/consent.ts#L26-L37), used by
  [`useConsent().reconcileWithServer()`](ui/app/composables/useConsent.ts#L24-L33)).
- Server storage/retrieval is [`GET`/`PUT /consent`](api/src/consent/consent.controller.ts),
  401 for guests — consent is only ever persisted server-side for a known
  account, reusing [`ConsentDto`](api/src/auth/auth.dto.ts#L11-L21).
- The UI-facing pieces are [`useConsent()`](ui/app/composables/useConsent.ts)
  and [`ConsentBanner.vue`](ui/app/components/ConsentBanner.vue).

### 3. Widget SDK lifecycle

[`useTecsafe()`](ui/app/composables/useTecsafe.ts) wraps a single
module-level `TecsafeWidgetManager` instance (the SDK requires exactly one
per page) and wires it to the shop:

- [`ensureManager()`](ui/app/composables/useTecsafe.ts#L23-L82) refuses to
  construct the manager without `consent.dataExchange` — this is the actual
  enforcement point of the consent rule above. It supplies the manager with:
  - a **customer-token callback** that calls `POST /tecsafe/token` (step 2
    above), forwarding the SDK's own previous token as `oldToken`;
  - an **article-info responder** for
    `InMessageRequestArticleInfo`/`OutMessageArticleInfo` (imported from the
    SDK's `IN_MESSAGES`/`OUT_MESSAGES` maps, not named exports) that answers
    from `GET /products/:articleNumber`, always responding — even
    `info: null` for unknown articles — so the widget never times out
    waiting for product data.
- SDK **0.5.1** uses a two-argument manager constructor and three business
  event handlers, registered synchronously before any widget starts:
  - **Article info** echoes the complete identifier (`gtin`,
    `manufacturerArticleNumber`, or `supplierArticleNumber`) and returns
    `hostShopArticleNumber`, boolean availability, tax category, and gross
    price scales. The demo resolves GTINs through its existing EAN endpoint.
  - **Layout prices** converts incoming net EUR layout and service prices to
    gross EUR using the session's tax categories (`S`: 19%, `AA`: 7%). It
    preserves quantity scales, discounts, request IDs, and service IDs.
    Every request receives one response: `success: true` with converted prices,
    or `success: false` with the original request ID and an error message if
    conversion fails. Failed responses omit all layout and service prices.
  - **Cart punchout** sends the complete transfer to `POST /cart/punchout`
    and replies once with `cart-punchout-result` after acceptance or failure.
    The API validates the batch and stores all positions in one update,
    retaining parent links, identifiers, quantities, pricing, and metadata.
    The cart displays supplied titles and line totals; the API also exposes
    effective unit prices. Each transfer receives its own `transferId`, and
    punchout positions are kept separate across repeated transfers.
    Ordinary shop additions still use
    `POST /cart/items`.
  Session configuration uses `language`, `currencyCode: 'EUR'`,
  `priceMode: 'gross'`, and the same `taxCategories` as layout-price conversion.
  This demo accepts widget-supplied punchout prices; a production shop must
  apply its own backend pricing rules.
- [`tecsafe.client.ts`](ui/app/plugins/tecsafe.client.ts) is the lifecycle
  glue: watching consent tears the manager down on withdrawal (SDK's GDPR
  requirement) or on a tracking-flag change (`trackingAllowed` is
  constructor-time only, so it must be rebuilt); watching the logged-in user
  calls `manager.refreshToken()` on every login/logout.
- [`product/[articleNumber].vue`](<ui/app/pages/product/[articleNumber].vue>)
  is the only mount point: it creates a `ProductDetailWidget` via
  `manager.createProductDetailWidget(...)` when consent is granted, shows a
  placeholder with a "open privacy settings" action otherwise, and destroys
  the widget on consent changes / unmount.

### 4. Generated OFCP dummy items

The demo generates a hidden catalog of placeholder products at API startup.
Configure the price sequence with server environment variables (also forwarded
by `compose.yml`):

| Variable | Default | Meaning |
| --- | --- | --- |
| `DUMMY_ITEM_START_PRICE` | `1` | First gross EUR price |
| `DUMMY_ITEM_INCREASE_PERCENT` | `5` | Percentage increase from the previous price |
| `DUMMY_ITEM_END_PRICE` | `250` | Maximum gross EUR price |

Each next price is `previous × (1 + percentage / 100)`, rounded to cents.
Generation stops before exceeding the end price; the item count varies.
For example, `10`, `50`, `33.75` produces prices `10.00`, `15.00`, `22.50`,
`33.75`. Prices must be positive with at most two decimal places, end must
be at least start, and the percentage must advance the price by at least
one cent. Invalid configurations or ranges exceeding 9,999 items fail at
startup. Restart the API after changing the parameters.

[`dummy-items.ts`](api/src/products/dummy-items.ts) creates article numbers
`OFCP-DUMMY-001` onward with unique EANs. One catalog backs product lookup,
cart pricing, and `GET /products/tecsafe-articles` for the SDK.

- `GET /products` hides dummy items.
- `GET /products/:articleNumber` and `GET /products/ean/:ean` resolve them.
- `GET /products?includeDummyItems=true` includes them in the listing;
  the product overview's demo toggle uses this flag.

### 5. Privacy versions and demo settings

Privacy settings offers three versions. The selected version and consent
are saved in the browser and, for logged-in users, the account:

- **v1 · recommended:** the required privacy settings checkbox is checked and
  disabled; saving this version enables data exchange with TECSAFE. Optional shop and TECSAFE
  usage tracking share one choice and remain off unless explicitly accepted.
- **v2 · legally transparent:** data exchange is explicit; optional usage
  tracking stays combined.
- **v3 · a lawyer’s friend:** data exchange, TECSAFE usage tracking, and
  native shop usage tracking are separate choices.

Only the TECSAFE usage choice controls the SDK's `trackingAllowed` flag.
The shop stores its native tracking choice without adding an analytics service.
Existing combined choices migrate to both usage fields. Changing tabs previews
a version; saving persists the selection. Tracking is unchecked for new visitors
in all versions. In v1, declining optional tracking keeps required privacy settings
enabled; in v2/v3, Decline all also declines data exchange. Previously saved
explicit tracking choices are restored when reopening the banner. The v1 privacy
policy link appears last and opens a demo alert in place of a real policy page.

**Demo Settings** (in the footer) groups existing settings into **Branding**,
**Debugger Settings**, and **Demo Sharing**. SDK mode enables the host-page
SDK debugger; widget mode replaces the product configurator with the debug
console. They can be enabled independently. Saved and shared demo settings
include both modes; older settings with the single debug switch preserve
their previous behavior by enabling both.

## Also in this repo (not OFCP-specific)

These exist to make the demo a believable shop, but don't touch the OFCP
protocol itself:

- **Whitelabel branding** — cosmetic shop rename/logo/colors, stored in
  `localStorage`/IndexedDB with an optional server-shared link
  ([`useWhitelabel.ts`](ui/app/composables/useWhitelabel.ts),
  [`api/src/whitelabel/`](api/src/whitelabel/)).
- **i18n** — German/English UI strings via `@nuxtjs/i18n`
  ([`ui/i18n/`](ui/i18n/)).
- **Retention cleanup** — an hourly job that prunes expired sessions, inactive
  accounts, orphaned carts and expired whitelabel shares from the JSON store
  ([`api/src/cleanup/cleanup.service.ts`](api/src/cleanup/cleanup.service.ts)).
  It only manages the shop's own session store; it never talks to TECSAFE or
  expires TECSAFE-side JWTs.
- **Docker/CI** — a single-container build (API+UI, Nitro proxies `/api`) and
  GitHub Actions for PR checks and `main`-push image publishing
  ([`Dockerfile`](Dockerfile), [`compose.yml`](compose.yml),
  [`.github/workflows/`](.github/workflows/)).

## Prerequisites

- Node 22 + pnpm
- A TECSAFE saleschannel API key (created in the cockpit's salesChannels
  settings; dev seed key of a local ofcp stack: `tds_sc_eshop_dev_key`)
- Optional: a local app-ui instance for local iframe testing (see below).
  By default, the demo uses `https://app-ui.tecsafe.de/iframe`.

## Running (one command)

From the repo root, start the API (:4000) and shop UI (:3000) together:

    pnpm install        # root: installs `concurrently`
    pnpm install:all    # installs api/ and ui/ dependencies
  pnpm dev

`pnpm dev` runs `api` (`start:dev`, watch mode) and `ui` (`nuxt dev`) under
`concurrently` with prefixed, colour-coded logs; Ctrl-C stops both. The API
listens on `:4000` and the UI on `:3000` — no port clash. You still need the
widget iframe host only if you want to test against a local app-ui instance
on `:3002` (see below).

There are no committed `.env.example` files anymore. Use environment
variables directly (inline, exported, direnv, or your own untracked `.env`
files).

Root `pnpm dev` defaults:

- `OFCP_SALESCHANNEL_API_KEY=tds_sc_eshop_dev_key`
- `OFCP_GATEWAY_URL=https://ofcp-api-gateway.staging.tecsafe.de`

Example with explicit overrides:

    OFCP_SALESCHANNEL_API_KEY=<key> OFCP_GATEWAY_URL=<gateway-url> pnpm dev

## Running (three terminals)

    # 1 — API on :4000
    cd api && pnpm install
    OFCP_SALESCHANNEL_API_KEY=<key> pnpm start:dev
    # optional: OFCP_GATEWAY_URL=http://localhost:8080 for a local ofcp stack
    # (api-only default gateway without override: http://localhost:4000)

    # 2 — optional: local app-ui (widget iframes) on :3002
    cd ../app-ui/nuxt && pnpm install && pnpm dev --port 3002

    # 3 — shop on :3000
    cd ui && pnpm install
    pnpm dev
    # optional for local app-ui:
    # NUXT_PUBLIC_WIDGET_BASE_URL=http://localhost:3002/iframe pnpm dev

Open http://localhost:3000.

## Running (Docker)

    docker compose up --build

One container runs both processes: the Nuxt UI (port 80, published as
http://localhost:8080) and the NestJS API (port 4000, container-internal).
The UI's Nitro server proxies `/api/**` to the API, so nothing else is
exposed. Data persists in the `shop-data` volume.

Environment variables are now default-driven (no committed `.env.example`
templates):

- Compose defaults (`compose.yml`):
  `OFCP_GATEWAY_URL=https://ofcp-api-gateway.staging.tecsafe.de`,
  `NUXT_PUBLIC_WIDGET_BASE_URL=https://app-ui.tecsafe.de`,
  `OFCP_SALESCHANNEL_API_KEY=tds_sc_eshop_dev_key`,
  `WHITELABEL_SHARE_SECRET=` (empty = sharing disabled).
- API code defaults (`ConfigService`) for standalone API runs:
  `PORT=4000`, `DATA_DIR=./data`, `OFCP_GATEWAY_URL=http://localhost:4000`,
  `GUEST_SESSION_TTL_DAYS=1`, `SESSION_TTL_DAYS=2`, `USER_TTL_DAYS=7`.
- API required without a code default:
  `OFCP_SALESCHANNEL_API_KEY` (the API fails at boot if missing when run
  directly without the root/compose defaults).
- UI/runtime defaults:
  `NUXT_PUBLIC_API_BASE=/api`,
  `NUXT_PUBLIC_WIDGET_BASE_URL=https://app-ui.tecsafe.de/iframe`,
  `API_PROXY_TARGET=http://localhost:4000` (dev server) /
  `http://127.0.0.1:4000` (Docker image).
Runtime data lives in
`api/data/*.json` — delete the folder to reset all users, sessions and carts.

The API runs an hourly retention cleanup: guest sessions idle longer than
`GUEST_SESSION_TTL_DAYS` and logged-in sessions idle longer than
`SESSION_TTL_DAYS` are removed, registered accounts inactive
longer than `USER_TTL_DAYS` are deleted along with their
sessions, and any cart whose session no longer exists is dropped, as are whitelabel
shares past their expiry. "Idle" is
measured from a session's last request (`lastSeenAt`). Whitelabel sharing
(`POST /whitelabel-shares`) is disabled unless `WHITELABEL_SHARE_SECRET` is set.

Note: the widget resolves articles against the TECSAFE cockpit of your
saleschannel. The demo catalog uses `5054598` and `TEST-123` (the article
numbers app-ui's own demo pages use); replace them in
`api/src/products/products.data.ts` with articles configured for your
saleschannel to see full configurator data.

## Manual acceptance checklist

1. **Consent banner (guest):** fresh private window → banner appears.
   Decline all → PDP shows a placeholder instead of the widget. Reload →
   still declined (stored in `localStorage['demo-shop-consent']`).
2. **Consent grant:** footer "Privacy settings" → allow data exchange →
   widget iframe loads on the PDP; `tecsafe-token` + `tecsafe-bid` appear in
   localStorage.
3. **Guest token:** DevTools network → `POST /tecsafe/token` returns a JWT;
   its payload (base64) has no `customerPayload` and `sub` ends in `:guest`.
4. **Add to cart:** configure in the widget / add via widget button → item
   appears on the cart page (configured items show their configurationId).
5. **Consent transfer (guest → register):** as a guest with consent chosen,
   register a new account → `GET /consent` (or re-login later) shows the
   same choice: the browser value was written to the account.
6. **Consent restore (login):** in a second private window (fresh guest,
   different/no consent), log in with that account → the account's consent
   replaces the local one; the banner stays closed.
7. **Session upgrade (login):** while logged in, `POST /tecsafe/token`
   responses carry `customerPayload` with your user id/email, and the
   request forwarded the previous guest token
   (`previousSaleschannelCustomerJwt`) — TECSAFE merges the guest assets.
8. **Logout:** header Logout → next token request is a guest token again;
   consent in this browser stays as chosen.
9. **Consent withdrawal:** "Privacy settings" → decline data exchange →
   iframe disappears (SDK `destroyAll()`), placeholder returns.
10. **Whitelabel:** footer "Shop appearance" → set a name, upload a logo
    (up to 2 MB), pick colors → header, footer and primary buttons rebrand
    instantly and survive a reload (name/colors in
    `localStorage['demo-shop-whitelabel']`, the logo blob in the
    `demo-shop-whitelabel` IndexedDB). "Reset to defaults" restores the
    original slate look.
11. **Whitelabel share link:** start the API with `WHITELABEL_SHARE_SECRET`
    set → "Shop appearance" → enter the secret and a duration → "Create
    link" returns a `/?wl=<id>` link. Opening it in a fresh private window
    applies the shared branding (including the logo) and strips the param;
    a wrong secret shows an error, an unset secret reports sharing as
    disabled, and expired links load the shop unchanged.
12. **Debug widget:** "Shop appearance" → tick "Enable debug widget" → Save.
    On a product page (with data-exchange consent) the product configurator is
    replaced by the TECSAFE debug console (`<widgetBaseUrl>/debug`) and a note
    says so; untick + Save brings the configurator back. The flag persists in
    `localStorage['demo-shop-whitelabel']` and rides the `/?wl=<id>` share link.

## Tests

    cd api && pnpm test && pnpm test:e2e
    cd ui && pnpm test && pnpm typecheck

## Dependency audit exceptions

The production dependency audits keep their `moderate` failure threshold.
`ui/pnpm-workspace.yaml` excludes only these reviewed advisories for which
no patched npm release is available:

- [GHSA-vfj7-8cjw-p6xm (braces)](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm):
  deeply nested glob patterns can exhaust the stack. The dependency is used
  by the Nuxt/i18n build tooling with repository-controlled patterns. The demo
  does not accept user-supplied glob patterns. `braces@3.0.3` is the latest
  published version; the audit's suggested `3.0.4` is not published.
- [GHSA-86w9-cpqp-85rv (node-forge)](https://github.com/advisories/GHSA-86w9-cpqp-85rv):
  RSA PKCS#1 v1.5 signature verification can accept malformed ASN.1 data.
  This dependency comes from listhen's local HTTPS certificate tooling;
  the demo does not use it to verify uploaded certificates or signatures.
  `node-forge@1.4.0` is the latest published release; the audit's suggested
  `1.4.1` is not published.

Remove an exception when a patched release can be installed. Reassess it
before exposing the affected glob or certificate functionality to user input.
