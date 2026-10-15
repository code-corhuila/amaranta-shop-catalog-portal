#!/usr/bin/env bash
# The whole catalog chain, REAL, with Docker only: MongoDB, the structure and the ten products of catalog-db (Liquibase),
# catalog-api, the gateway, the shell and this portal. Nothing in it is a double.
#
#   bash scripts/e2e-real-stack.sh up       builds and starts everything, then prints the address to open
#   bash scripts/e2e-real-stack.sh check    asserts, over HTTP, what the whole chain must do
#   bash scripts/e2e-real-stack.sh down     removes everything it created
#
# It needs the other repositories next to this one, or their paths in CATALOG_DB_DIR, CATALOG_API_DIR, GATEWAY_DIR and
# FRONT_DIR, checked out at the code to run. Only the PUBLIC half of a throwaway signing key reaches the services; the key
# and two test tokens (ADMIN and CUSTOMER) stay in .stack/, which git ignores, and `down` deletes it.
set -euo pipefail
cd "$(dirname "$0")/.."
# Git Bash on Windows must not rewrite the container paths given to docker, but openssl (a Windows program) does need
# its own paths converted: so the switch is set for docker only.
docker() { MSYS_NO_PATHCONV=1 command docker "$@"; }

NET=amaranta-real-stack
MONGO=real-mongo; API=real-catalog-api; GATEWAY=real-gateway; SHELL_C=real-shell; PORTAL=real-portal
STATE=.stack
ADMIN=amaranta_admin
FOOD=399d2ea8-1ccb-4193-8255-1b51e331984d   # FOOD-001 Croquetas Adulto Salmon 15kg: the id the monolith issued

sibling() { # sibling <VAR> <default relative path>: the directory as docker wants it, or stop
  local path="${!1:-$2}"
  ( cd "$path" 2> /dev/null && { pwd -W 2> /dev/null || pwd; } ) || { echo "$1 not found: clone it next to this repository or set $1" >&2; exit 1; }
}

down() {
  docker rm -f "$MONGO" "$API" "$GATEWAY" "$SHELL_C" "$PORTAL" > /dev/null 2>&1 || true
  docker network rm "$NET" > /dev/null 2>&1 || true
  # The images carry the tag :real, so building over an existing one would fail ("already exists") on Docker Desktop.
  docker rmi catalog-db-liquibase:real catalog-api:real api-gateway:real shell:real catalog-portal:real > /dev/null 2>&1 || true
  rm -rf "$STATE"
}

up() {
  down
  local DB_DIR API_DIR GW_DIR FRONT_DIR
  DB_DIR="$(sibling CATALOG_DB_DIR ../amaranta-shop-catalog-db)"
  API_DIR="$(sibling CATALOG_API_DIR ../amaranta-shop-catalog-api)"
  GW_DIR="$(sibling GATEWAY_DIR ../amaranta-shop-api-gateway)"
  FRONT_DIR="$(sibling FRONT_DIR ../amaranta-shop-front)"
  mkdir -p "$STATE"

  echo "== a signing key (only the public half goes to the service) and two test tokens"
  openssl genrsa -out "$STATE/private.pem" 2048 2> /dev/null
  local PUBLIC PW APP_PW
  PUBLIC="$(openssl rsa -in "$STATE/private.pem" -pubout 2> /dev/null | awk '{printf "%s\\n", $0}')"
  PW="$(openssl rand -hex 16)"; APP_PW="$(openssl rand -hex 16)"
  b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
  token() { # token <role>: a valid RS256 token, expiring in 2030
    local head body sig
    head="$(printf '{"alg":"RS256","typ":"JWT"}' | b64url)"
    body="$(printf '{"sub":"33333333-3333-4333-8333-333333333333","role":"%s","exp":1893456000}' "$1" | b64url)"
    sig="$(printf '%s.%s' "$head" "$body" | openssl dgst -sha256 -sign "$STATE/private.pem" | b64url)"
    echo "$head.$body.$sig"
  }
  token ADMIN > "$STATE/admin.token"; token CUSTOMER > "$STATE/customer.token"

  echo "== the database and its structure (catalog-db)"
  docker network create "$NET" > /dev/null
  docker build -q -t catalog-db-liquibase:real -f "$DB_DIR/deploy/liquibase.Dockerfile" "$DB_DIR/deploy" > /dev/null
  # --tmpfs: Mongo declares /data/db as a volume, and without it every run would leave an anonymous volume behind.
  docker run -d --name "$MONGO" --network "$NET" --network-alias mongo --tmpfs /data/db -e MONGO_INITDB_ROOT_USERNAME="$ADMIN" \
    -e MONGO_INITDB_ROOT_PASSWORD="$PW" mongo:7.0 > /dev/null
  until docker logs "$MONGO" 2>&1 | grep -q "MongoDB init process complete"; do sleep 1; done
  mongo_admin() { docker exec -i "$MONGO" mongosh --quiet -u "$ADMIN" -p "$PW" --authenticationDatabase admin --eval "$1"; }
  until mongo_admin "db.adminCommand('ping').ok" 2> /dev/null | grep -qx 1; do sleep 1; done
  mongo_admin "db.getSiblingDB('catalog').createUser({ user: 'catalog_app', pwd: '$APP_PW', roles: [{ role: 'readWrite', db: 'catalog' }] })" > /dev/null
  docker run --rm --network "$NET" -v "$DB_DIR:/workspace:ro" -e LIQUIBASE_COMMAND_USERNAME="$ADMIN" \
    -e LIQUIBASE_COMMAND_PASSWORD="$PW" --entrypoint liquibase catalog-db-liquibase:real \
    --search-path=/workspace --changelog-file=changelog/changelog-master.yaml \
    --database-changelog-table-name=databasechangelog_catalog --database-changelog-lock-table-name=databasechangeloglock_catalog \
    --url="mongodb://mongo:27017/catalog?authSource=admin" update 2>&1 | grep -E "^Run:|ERROR|rror:" || true

  echo "== the services (their container images)"
  docker build -q -f "$API_DIR/deploy/Dockerfile" -t catalog-api:real "$API_DIR" > /dev/null
  docker build -q -f "$GW_DIR/deploy/Dockerfile" -t api-gateway:real "$GW_DIR" > /dev/null
  docker build -q -f "$FRONT_DIR/deploy/Dockerfile" -t shell:real "$FRONT_DIR" > /dev/null
  docker build -q -f deploy/Dockerfile -t catalog-portal:real . > /dev/null
  docker run -d --name "$API" --network "$NET" --network-alias catalog-api \
    -e "MONGODB_URI=mongodb://catalog_app:$APP_PW@mongo:27017/catalog?authSource=catalog" -e "JWT_PUBLIC_KEY=$PUBLIC" \
    catalog-api:real > /dev/null
  docker run -d --name "$GATEWAY" --network "$NET" --network-alias gateway -p 8000:8000 api-gateway:real > /dev/null
  docker run -d --name "$PORTAL" --network "$NET" --network-alias portal -p 4201:4201 catalog-portal:real > /dev/null
  docker run -d --name "$SHELL_C" --network "$NET" --network-alias shell -p 4200:4200 shell:real > /dev/null

  for _ in $(seq 1 60); do
    [ "$(http_code http://gateway:8000/api/v1/products)" = "200" ] && break
    sleep 1
  done
  [ "$(http_code http://gateway:8000/api/v1/products)" = "200" ] || { echo "FAIL: the chain did not come up" >&2; docker logs --tail 20 "$API" >&2; exit 1; }
  echo
  echo "UP. Open the shell:   http://localhost:4200/catalog"
  echo "    the gateway:      http://localhost:8000/api/v1/products"
  echo "    test tokens:      $STATE/admin.token and $STATE/customer.token (paste one at /sign-in)"
  echo "    stop and clean:   bash scripts/e2e-real-stack.sh down"
}

curl_net() { docker run --rm --network "$NET" curlimages/curl:latest -s "$@"; }
http_code() { curl_net -o /dev/null -w '%{http_code}' "$@" 2> /dev/null || true; }

fail=0
ok()   { echo "  ok    $1"; }
bad()  { echo "  FAIL  $1"; fail=1; }
expect_code() { # description, expected code, curl arguments...
  local desc="$1" want="$2"; shift 2
  local got; got="$(http_code "$@")"
  if [ "$got" = "$want" ]; then ok "$desc ($got)"; else bad "$desc: want $want, got $got"; fi
}
expect_body() { # description, grep pattern, curl arguments...
  local desc="$1" pattern="$2"; shift 2
  if curl_net "$@" | grep -qE -- "$pattern"; then ok "$desc"; else bad "$desc: missing $pattern"; fi
}

check() {
  [ -f "$STATE/admin.token" ] || { echo "the stack is not up: run 'up' first" >&2; exit 1; }
  local ADMIN_T CUSTOMER_T G=http://gateway:8000
  ADMIN_T="$(cat "$STATE/admin.token")"; CUSTOMER_T="$(cat "$STATE/customer.token")"

  echo "the public catalog, through the gateway, with no token"
  expect_code "the list answers" 200 "$G/api/v1/products?limit=100"
  expect_body "...with the ten seeded products" '"total":10' "$G/api/v1/products?limit=100"
  expect_body "...in the shape the portal reads: {data, meta}" '^\{"data":\[.*\],"meta":\{"page":1,"limit":100,"total":10,"totalPages":1\}\}$' "$G/api/v1/products?limit=100"
  expect_body "a page of 3 is a page of 3" '"limit":3,"total":10,"totalPages":4' "$G/api/v1/products?page=2&limit=3"
  expect_code "one product answers" 200 "$G/api/v1/products/$FOOD"
  expect_body "...the one the monolith issued" 'Croquetas' "$G/api/v1/products/$FOOD"
  expect_code "an unknown id is a 404" 404 "$G/api/v1/products/00000000-0000-4000-8000-000000000000"
  expect_body "...with the envelope" '"error":"NOT_FOUND"' "$G/api/v1/products/00000000-0000-4000-8000-000000000000"
  expect_code "an id that is not an id is a 400" 400 "$G/api/v1/products/not-a-uuid"
  expect_code "a limit of 101 is a 400" 400 "$G/api/v1/products?limit=101"

  echo "the administration is closed by role"
  expect_code "no credential: the gateway refuses (401)" 401 "$G/api/v1/admin/products"
  expect_code "a customer: the service refuses (403)" 403 -H "Authorization: Bearer $CUSTOMER_T" "$G/api/v1/admin/products"
  expect_code "an admin: the list answers" 200 -H "Authorization: Bearer $ADMIN_T" "$G/api/v1/admin/products"
  expect_code "a token with a broken signature is the service's 401" 401 -H "Authorization: Bearer ${ADMIN_T%?}x" "$G/api/v1/admin/products"

  echo "what the gateway never publishes"
  expect_code "reserve-stock is not routed" 404 -X POST -H "Authorization: Bearer $ADMIN_T" "$G/internal/products/reserve-stock"
  expect_code "nor under the public prefix" 404 -X POST -H "Authorization: Bearer $ADMIN_T" "$G/api/v1/internal/products/reserve-stock"

  echo "one correlation id, from the browser to the service (norm 5.3.9)"
  curl_net -o /dev/null -H 'X-Correlation-Id: e2e-trace-7' "$G/api/v1/products/$FOOD"
  if docker logs "$GATEWAY" 2>&1 | grep -q 'e2e-trace-7'; then ok "it is in the log of the gateway"; else bad "it is not in the log of the gateway"; fi
  if docker logs "$API" 2>&1 | grep -q 'e2e-trace-7'; then ok "...and in the log of catalog-api"; else bad "...and not in the log of catalog-api"; fi

  echo "the shell and the portal"
  expect_code "the shell answers" 200 http://shell:4200/
  expect_code "the portal's remoteEntry.js answers" 200 http://portal:4201/remoteEntry.js
  expect_body "the shell's origin may load the portal" 'Access-Control-Allow-Origin: http://localhost:4200' -i -H 'Origin: http://localhost:4200' http://portal:4201/remoteEntry.js
  expect_code "the browser's preflight from the shell passes the gateway" 204 -X OPTIONS -H 'Origin: http://localhost:4200' -H 'Access-Control-Request-Method: GET' "$G/api/v1/products"

  [ "$fail" = 0 ] && echo "OK: the whole chain does what it must" || { echo "FAILED"; exit 1; }
}

case "${1:-}" in
  up) up ;;
  check) check ;;
  down) down; echo "removed" ;;
  *) echo "usage: bash scripts/e2e-real-stack.sh up | check | down" >&2; exit 2 ;;
esac
