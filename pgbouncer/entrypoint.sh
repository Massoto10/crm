#!/bin/sh
set -e

# Gera o userlist.txt no arranque, a partir do hash SCRAM que o próprio Postgres
# já guarda.
#
# Copiar a senha em claro para dentro do userlist seria mais simples, mas
# colocaria a senha do banco num arquivo a mais, num formato a mais, que
# precisaria ser rotacionado junto — e que ninguém lembraria de rotacionar.
# Puxando de pg_shadow, existe uma fonte só.

: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:=postgres}"

if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "pgbouncer: POSTGRES_PASSWORD não definida" >&2
  exit 1
fi

echo "pgbouncer: aguardando o Postgres em $POSTGRES_HOST:$POSTGRES_PORT"
until PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" \
      -U "$POSTGRES_USER" -d postgres -c 'SELECT 1' >/dev/null 2>&1; do
  sleep 2
done

HASH=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" \
       -U "$POSTGRES_USER" -d postgres -tAc \
       "SELECT passwd FROM pg_shadow WHERE usename = '$POSTGRES_USER'")

if [ -z "$HASH" ]; then
  echo "pgbouncer: não consegui ler o hash de $POSTGRES_USER em pg_shadow" >&2
  exit 1
fi

printf '"%s" "%s"\n' "$POSTGRES_USER" "$HASH" > /etc/pgbouncer/userlist.txt
chmod 600 /etc/pgbouncer/userlist.txt

echo "pgbouncer: userlist gerado para $POSTGRES_USER"
exec pgbouncer /etc/pgbouncer/pgbouncer.ini
