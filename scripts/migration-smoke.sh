#!/usr/bin/env bash
#
# Smoke-проверка публичной поверхности GOO Fashion.
#
# Написан для миграции на новый сервер (см. MIGRATION_RUNBOOK.md): один и тот же
# прогон снимается с боевого сервера до переключения и с нового — после, числа
# сравниваются. Проверяет и приложение, и self-hosted Supabase, потому что
# картинки живут на нём и «сайт открылся» ещё не значит «сайт работает».
#
# Использование:
#   scripts/migration-smoke.sh                      # боевой домен как есть
#   RESOLVE_IP=1.2.3.4 INSECURE=1 scripts/…         # тот же домен, но в обход DNS —
#                                                   # так новый сервер проверяется
#                                                   # ДО переключения A-записей
#                                                   # (INSECURE нужен, пока Let's
#                                                   # Encrypt не выпустил сертификат)
#   BASE=https://goo-new.goo-fashion.com scripts/…  # временный домен
#
# Выход 0 — всё зелёное. Ненулевой — количество провалившихся проверок.

set -uo pipefail

BASE="${BASE:-https://goo-fashion.com}"
SUPA="${SUPA:-https://supabase.goo-fashion.com}"
RESOLVE_IP="${RESOLVE_IP:-}"
INSECURE="${INSECURE:-}"
TIMEOUT="${TIMEOUT:-45}"

# Ожидаемые числа, снятые с прода 2026-08-21. При росте каталога обновить —
# проверка на «не меньше», чтобы новые товары не роняли прогон.
EXPECT_PRODUCTS="${EXPECT_PRODUCTS:-516}"
EXPECT_SITEMAP="${EXPECT_SITEMAP:-545}"

fail=0
pass() { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=$((fail + 1)); }
info() { printf '  --   %s\n' "$1"; }

host_of() { printf '%s' "${1#*://}" | cut -d/ -f1; }

# curl со всеми нужными флагами: --resolve для проверки сервера в обход DNS,
# -k пока нет сертификата.
c() {
  local url="$1"; shift
  local args=(-sS --max-time "$TIMEOUT")
  [ -n "$INSECURE" ] && args+=(-k)
  if [ -n "$RESOLVE_IP" ]; then
    local h
    for h in "$(host_of "$BASE")" "www.$(host_of "$BASE" | sed 's/^www\.//')" "$(host_of "$SUPA")"; do
      args+=(--resolve "$h:443:$RESOLVE_IP" --resolve "$h:80:$RESOLVE_IP")
    done
  fi
  curl "${args[@]}" "$@" "$url"
}

code_of() { c "$1" -o /dev/null -w '%{http_code}'; }

echo "BASE=$BASE  SUPA=$SUPA${RESOLVE_IP:+  RESOLVE_IP=$RESOLVE_IP}"

echo
echo "DNS"
for h in "$(host_of "$BASE")" "$(host_of "$SUPA")"; do
  ip=$(getent hosts "$h" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ')
  if [ -n "$ip" ]; then info "$h -> $ip"; else bad "$h не резолвится"; fi
done

echo
echo "Страницы"
for p in / /browse /blog /plans /subscribe /report /about; do
  code=$(code_of "$BASE$p")
  [ "$code" = "200" ] && pass "$p -> 200" || bad "$p -> $code (ожидалось 200)"
done

echo
echo "Каноничный хост"
apex=$(host_of "$BASE" | sed 's/^www\.//')
loc=$(c "https://www.$apex/" -o /dev/null -w '%{http_code} %{redirect_url}')
case "$loc" in
  308*) pass "www -> 308 ${loc#* }" ;;
  *)    bad  "www отдал '$loc', ожидался 308 на https://$apex/" ;;
esac

echo
echo "Каталог"
prods=$(c "$BASE/api/products" | grep -o '"retailers"' | wc -l | tr -d ' ')
if [ "$prods" -ge "$EXPECT_PRODUCTS" ]; then
  pass "/api/products -> $prods товаров (ожидалось >= $EXPECT_PRODUCTS)"
else
  bad "/api/products -> $prods товаров, ожидалось >= $EXPECT_PRODUCTS"
fi

urls=$(c "$BASE/sitemap.xml" | grep -o '<loc>' | wc -l | tr -d ' ')
if [ "$urls" -ge "$EXPECT_SITEMAP" ]; then
  pass "sitemap.xml -> $urls URL (ожидалось >= $EXPECT_SITEMAP)"
else
  bad "sitemap.xml -> $urls URL, ожидалось >= $EXPECT_SITEMAP"
fi

echo
echo "Supabase (база и хранилище)"
# PostgREST без ключа обязан отвечать 401, а не 502: 401 значит, что Kong и
# postgrest живы, просто не пускают без токена.
code=$(code_of "$SUPA/rest/v1/")
case "$code" in
  401|200) pass "/rest/v1/ -> $code (шлюз и PostgREST отвечают)" ;;
  *)       bad  "/rest/v1/ -> $code (ожидалось 401)" ;;
esac

# Первая ссылка на своё хранилище прямо с главной — сквозная проверка
# «база отдала URL → Storage отдал файл».
img=$(c "$BASE/" | grep -oE "https://[a-z0-9.-]+/storage/v1/object/public/[^\"&?\\\\ ]+" | head -1)
if [ -z "$img" ]; then
  bad "на главной нет ни одной ссылки на Storage — каталог не отрисовался"
else
  code=$(code_of "$img")
  [ "$code" = "200" ] && pass "Storage: $(basename "$img") -> 200" \
                      || bad "Storage: $img -> $code"
  info "хост хранилища: $(host_of "$img")"
fi

echo
if [ "$fail" -eq 0 ]; then
  printf '\033[32mВсе проверки прошли\033[0m\n'
else
  printf '\033[31mПровалено проверок: %d\033[0m\n' "$fail"
fi
exit "$fail"
