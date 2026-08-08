# PgBouncer com psql, necessário para o entrypoint ler o hash SCRAM de pg_shadow
# no arranque em vez de manter uma segunda cópia da senha do banco.
FROM alpine:3.20

# O pacote do Alpine não cria o usuário — precisa ser explícito, senão o
# processo roda como root sem necessidade.
RUN apk add --no-cache pgbouncer postgresql16-client \
 && addgroup -S pgbouncer 2>/dev/null || true \
 && adduser -S -D -H -G pgbouncer pgbouncer 2>/dev/null || true

COPY pgbouncer.ini /etc/pgbouncer/pgbouncer.ini
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
 && mkdir -p /var/log/pgbouncer /var/run/pgbouncer \
 && chown -R pgbouncer:pgbouncer /etc/pgbouncer /var/log/pgbouncer /var/run/pgbouncer

USER pgbouncer
EXPOSE 6432
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
