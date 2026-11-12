#!/usr/bin/env bash
cd "$(dirname "$0")" || exit 1

run() {
  echo "\$ $*"
  "$@"
}

psql() {
  docker exec -i vjakarta-db psql -q -U tickets -d tickets "$@"
}

db() {
  if docker ps -a --format '{{.Names}}' | grep -qx vjakarta-db; then
    docker start vjakarta-db > /dev/null
  else
    docker run -d --name vjakarta-db -p 5432:5432 \
      -e POSTGRES_USER=tickets -e POSTGRES_PASSWORD=tickets -e POSTGRES_DB=tickets \
      postgres:16-alpine > /dev/null
  fi
  until docker exec vjakarta-db pg_isready -q -U tickets -d tickets; do sleep 0.5; done
  psql < db/schema.sql
  echo "database ready on :5432"
}

case "$1" in
  db)       db ;;
  reset)    psql -c 'truncate holds' && echo "holds emptied" ;;
  provider) run java -Dlimit="${LIMIT:-20}" -Dmillis="${MILLIS:-50}" provider/PaymentProvider.java ;;
  app)      run mvn -q liberty:dev ;;
  *)        echo "usage: ./run.sh db|reset|provider|app" ;;
esac
