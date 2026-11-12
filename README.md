# amaranta-shop-catalog-portal

> catalog bounded context: web UI (remote)

Part of the **Amaranta Shop** distributed system — team `amaranta-shop`, Grupo 2.
Governance and documentation live in [`amaranta-shop-docs`](https://github.com/code-corhuila/amaranta-shop-docs).

## Branching

Three permanent branches. **None of them accepts a direct commit** — you enter through a child
branch and leave through a Pull Request.

```
develop  <--PR--  feat/... fix/... chore/...
qa       <--PR--  qa/...
main     <--PR--  release/...  hotfix/...
```

Promotion happens **by re-application** (`git cherry-pick -x`), never by merging one permanent
branch into another: `merge develop -> qa` and `merge qa -> main` do not exist in this model.

`main` requires **1 approval from `ariel5253`**. On `develop` and `qa` the team sets its own review
rule.

Full policy: `00-governance/branching-policy.md` in `amaranta-shop-docs`.

## Role in the system

The web interface of the **catalog domain**: the public catalog, with its filters, the detail of one product, and the
administration of the catalog for an `ADMIN`. It is a **remote** loaded by the shell (`amaranta-shop-front`) when the route
`/catalog` is opened, not an application of its own.

| Screen | Route (under `/catalog`) | Who | Talks to |
|---|---|---|---|
| Product list, filtered and paged | `/`, `?q=&category=&page=` | anyone | `GET /api/v1/products?page=&limit=` |
| Product detail | `/products/:id` | anyone | `GET /api/v1/products/{id}` |
| Administration: list | `/admin` | `ADMIN` | `GET /api/v1/admin/products`, `POST .../{id}/activate`, `POST .../{id}/deactivate`, `DELETE .../{id}` |
| Administration: new product | `/admin/new` | `ADMIN` | `POST /api/v1/admin/products` |
| Administration: edit and stock | `/admin/:id/edit` | `ADMIN` | `PATCH /api/v1/admin/products/{id}`, `PATCH .../{id}/stock` |
| Anything else | `*` | anyone | nothing: its own 404 |

Browsing is public: a visitor can browse without an account (spec DP-1).

## The rule this portal obeys (Annex H)

**The HTTP client and the session live in the shell, and only there.** The portal borrows two things from the shell through
Module Federation: `shell/apiClient`, to ask for relative paths (`/api/v1/products`), and `shell/auth`, to ask who is signed in
(`useSessionInfo()`: the role, **never the token**) and to guard a screen (`RequireRole`). It never calls `fetch`, never touches
a token, and does not know where the gateway is. Two checks enforce it:

- `src/architecture.test.ts` reads the source of the portal and fails on its own `fetch` or `XMLHttpRequest`, an HTTP library,
  `Authorization`/`Bearer`, browser storage, the address of the gateway, or an `/internal` route; on an API route named outside
  `api/`; and on the session read any way but `shell/auth`;
- the `build` stage of `deploy/Dockerfile` greps the **compiled** code for the gateway address and the token.

## What each screen does (Annex H)

| Rule | Where |
|---|---|
| Four states, designed: loading (placeholders in the shape of the cards), an error with the reference and a retry, empty, and data | every page |
| A newer request replaces the older one: the older is cancelled, and its answer is ignored even if it arrives late | `hooks/useRequest.ts` |
| An error shows the text the shell decided for the person and the `traceId` to give; a failure that did not come from the shell gets a neutral text, never its technical message | `model/failure.ts`, `FailureNotice` |
| A 404, or an address that is not an id, offers the way back instead of a retry that cannot help | `ProductPage` |
| The page, the search and the category come from the address, so a filtered view can be shared and survives a reload | `CatalogPage` |
| **Money is read from text, never from a float**: `189000`, `189.000` and `$ 189.000` are the same price; `10.5` is refused beside the field, never sent as `105` | `model/numbers.ts` |
| A label for every field; what is wrong is written beside the field and joined to it (`aria-describedby`); the cursor goes to the first one that is wrong | `ProductForm` |
| The button is disabled while a request is pending, so a double click cannot create two products | `ProductForm`, `StockForm`, `AdminListPage` |
| What the service refuses is shown in the person's words, beside the field it named; its English text is never shown | `model/productForm.ts` |
| Deleting asks first, and does nothing if the person changes their mind | `AdminListPage` |
| An inactive product is read through the administration list: the public route answers 404 for it | `EditProductPage` |
| The id from the address is encoded in every path, so it can only name one product | `catalogApi.ts`, `adminApi.ts` |

The types in `src/catalog/model/` use the same field names as `amaranta-shop-catalog-api`, `Page<T>` with `data` and `meta` included.

### The filters

`catalog-api` pages but does not filter. Without a filter the portal asks the service for a page of 12. With one, it loads the
whole catalog **once** (pages of 100, capped at 50 pages), filters it here (any word, in the name, the description or the code,
ignoring case and accents: "salm" finds "Salmón") and pages it here; typing a letter does not ask the service again. Asking the
service to filter (`category` and `q`) is the proper fix and a change in `catalog-api`.

### The look

The stylesheet (`src/catalog/catalog.css`) has no colour of its own: every colour, radius and shadow is a token of the shell's
design system (ADR-007). A test reads it and fails on a literal colour, on a token the shell does not define, and on removing the
focus ring.

## Stack

React 19, Vite, strict TypeScript, Vitest and Module Federation (`@module-federation/vite`), on Node 22: the same toolchain as the
shell. The choice of React is recorded in ADR-014 of `amaranta-shop-docs`.

## How to run

You need only Docker; nothing is installed on the machine.

```bash
bash scripts/test.sh
```

In containers, from the versioned `package-lock.json` (`npm ci`), it runs:

1. the strict type check and the test suite (**180 tests**, written first);
2. the production build, which must produce `remoteEntry.js` and whose compiled code must not contain the gateway address or a token;
3. the final image, started, and `tests/serve.sh` against it: `remoteEntry.js` is never cached, hashed files are cached for a
   year, a missing file is a `404`, and only the shell's origin may load it.

The same script runs in CI on every pull request.

### The whole chain, for real

```bash
bash scripts/e2e-real-stack.sh up
```

It builds and starts MongoDB, the structure and the ten products of `catalog-db`, `catalog-api`, the gateway, the shell and this
portal, with nothing replaced by a double (the other repositories must sit next to this one, or be named in `CATALOG_DB_DIR`,
`CATALOG_API_DIR`, `GATEWAY_DIR` and `FRONT_DIR`). Then:

```bash
bash scripts/e2e-real-stack.sh check
```

asserts, over HTTP, what the chain must do (43 checks): the ten products and the shape the portal reads, paging, 404 and 400, the
administration closed by role, the whole administration (create, a taken code, `10.5` refused, edit, stock, switch off and on,
delete) leaving the catalog as it found it, `/internal` unreachable, and **one `X-Correlation-Id` in the log of the gateway and in
the log of `catalog-api`**. And to remove everything it created, the keys and tokens included:

```bash
bash scripts/e2e-real-stack.sh down
```

## Verified

Besides the tests, in a real browser with that whole chain up: the catalog draws with the design system and the photos of the seed;
"salm" finds "Croquetas Adulto Salmón"; a visitor who opens `/catalog/admin` is taken to the sign-in; as an `ADMIN` (a test token
signed with a throwaway key) the table lists the ten products, a product is created with a price typed as `32.000` (saved as
32000 pesos), switched off (and the public catalog, asked apart, stops listing it) and deleted after confirming; and as a
`CUSTOMER` the section says there is no permission and the portal asks the service for nothing.

## Status

Done: the public catalog with its filters, the detail, and the administration. Not done:

- **Edit and stock screens in a browser.** They are tested (unit tests and the 43 checks of the API they use) but were not clicked
  through in a browser; create, switch off and delete were.
- **Filtering in the service.** See above.
- **Uploading a picture.** A product's picture is an address (`http://` or `https://`); `catalog-api` does not take files.
- The portal has **no sign-in of its own**, by design: the shell's development sign-in exists only while developing, and the
  identity portal does not exist yet.
