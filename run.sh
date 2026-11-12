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

load() {
  local name=${1:?name the run, for example ./run.sh load before small}
  case "${2:-small}" in
    small) export SALE_RATE=${SALE_RATE:-120} SALE_SECONDS=${SALE_SECONDS:-6} ;;
    big)   export SALE_RATE=${SALE_RATE:-640} SALE_SECONDS=${SALE_SECONDS:-3} ;;
  esac
  mkdir -p results
  K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT="results/$name.html" K6_CSV_TIME_FORMAT=unix_milli \
    run k6 run -q --out csv="results/$name.csv" load/flash-sale.js
  python3 tools/series.py "results/$name.csv"
}

state() {
  run git restore --source="${1:?which state: before, switched, budgeted, deadlines or main}" src provider db
  grep -h "@ManagedExecutorDefinition" src/main/java/ca/bazlur/tickets/TicketsApplication.java
}

sum() {
  awk -v pattern="$2" '$0 ~ pattern {s += $2} END {printf "%d", s}' <<< "$1"
}

watch() {
  local waits retries refused previous=""
  while true; do
    local metrics; metrics=$(curl -s localhost:9080/metrics)
    local now_waits now_retries now_refused
    now_waits=$(sum "$metrics" '^connectionpool_queuedRequests_total')
    now_retries=$(sum "$metrics" '^ft_retry_retries_total')
    now_refused=$(sum "$metrics" 'door_refused_total')
    if [ -n "$previous" ]; then
      printf "in flight %4d   waited for a connection %5d   retries %5d   turned away %4d\n" \
        "$(sum "$metrics" '^in_flight')" $((now_waits - waits)) $((now_retries - retries)) $((now_refused - refused))
    fi
    waits=$now_waits retries=$now_retries refused=$now_refused previous=1
    sleep 1
  done
}

case "$1" in
  db)       db ;;
  reset)    psql -c 'truncate holds' && echo "holds emptied" ;;
  provider) run java -Dlimit="${LIMIT:-20}" -Dmillis="${MILLIS:-50}" provider/PaymentProvider.java ;;
  app)      run mvn -q liberty:dev ;;
  state)    state "$2" ;;
  load)     load "$2" "$3" ;;
  watch)    watch ;;
  *)        echo "usage: ./run.sh db|reset|provider|app|state <tag>|load <name> small|big|watch" ;;
esac
