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

The web interface of the **catalog domain**: the public list of products and the detail of one. It is a **remote** loaded by
the shell (`amaranta-shop-front`) when the route `/catalog` is opened, not an application of its own.

| Screen | Route (under `/catalog`) | Talks to |
|---|---|---|
| Product list, paged | `/` and `?page=` | `GET /api/v1/products?page=&limit=` |
| Product detail | `/products/:id` | `GET /api/v1/products/{id}` |
| Anything else | `*` | nothing: its own 404 |

Both are public: a visitor can browse without an account (spec DP-1).

## The rule this portal obeys (Annex H)

**The HTTP client and the session live in the shell, and only there.** The portal borrows the shell's client as
`shell/apiClient` through Module Federation and asks for relative paths (`/api/v1/products`). It never calls `fetch`, never
touches a token, and does not know where the gateway is. Two checks enforce it:

- `src/architecture.test.ts` reads the source of the portal and fails on its own `fetch` or `XMLHttpRequest`, an HTTP library,
  `Authorization`/`Bearer`, browser storage, the address of the gateway, or an `/internal` route;
- the `build` stage of `deploy/Dockerfile` greps the **compiled** code for the gateway address and the token.

## What each screen does (Annex H)

| Rule | Where |
|---|---|
| Four states, designed: loading, an error with the reference and a retry, empty, and data | `CatalogPage`, `ProductPage` |
| A newer request replaces the older one: the older is cancelled, and its answer is ignored even if it arrives late | `hooks/useRequest.ts` |
| An error shows the text the shell decided for the person and the `traceId` to give; a failure that did not come from the shell gets a neutral text, never its technical message | `model/failure.ts`, `FailureNotice` |
| A 404, or an address that is not an id, offers the way back instead of a retry that cannot help | `ProductPage` |
| The page comes from the address; anything that is not a whole number from 1 up is the first page | `CatalogPage` |
| The id from the address is encoded, so it can only name one product and never another path | `catalogApi.ts` |
| Money is shown as the service formatted it (`priceFormatted`); the portal never does arithmetic with it | `ProductCard` |
| An out-of-stock product is listed as `Agotado`, not hidden | `ProductCard`, `ProductPage` |

The types in `src/catalog/model/` use the same field names as `amaranta-shop-catalog-api`, `Page<T>` with `data` and `meta` included.

## Stack

React 19, Vite, strict TypeScript, Vitest and Module Federation (`@module-federation/vite`), on Node 22: the same toolchain as the
shell. The choice of React is recorded with the shell's.

## How to run

You need only Docker; nothing is installed on the machine.

```bash
bash scripts/test.sh
```

In containers, from the versioned `package-lock.json` (`npm ci`), it runs:

1. the strict type check and the test suite;
2. the production build, which must produce `remoteEntry.js` and whose compiled code must not contain the gateway address or a token;
3. the final image, started, and `tests/serve.sh` against it: `remoteEntry.js` is never cached, hashed files are cached for a
   year, a missing file is a `404`, and only the shell's origin may load it.

The same script runs in CI on every pull request. To see it, run it with the shell and the gateway:

```bash
docker build -f deploy/Dockerfile -t catalog-portal:dev .
```

```bash
docker run --rm -p 4201:4201 catalog-portal:dev
```

Then open the shell at `http://localhost:4200/catalog` (see `amaranta-shop-front`). With the portal off, only its area of the shell
says it is unavailable.

## Verified

Loaded into the real shell, behind the real gateway, with a stand-in for the catalog service that answers the real JSON shape
(checked in a browser): the list and the detail draw; the browser's preflight passes; with the service stopped the screen shows
the shell's message and a reference that is exactly the `correlationId` of the gateway's `503` log line; and **Reintentar** shows
the products again. The tests are 42, written first.

## Status

Done: the public list and the detail. Not done:

- **Against the real `catalog-api` and MongoDB.** It has only run against a stand-in with the same JSON shape.
- **The administration** of the catalog (`/api/v1/admin/products`: create, edit, stock, activate, delete), which needs a signed-in `ADMIN`.
- **Appearance.** There are no styles; the product image is only shown on the detail.
- Search and filters by category.
