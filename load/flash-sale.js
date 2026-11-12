import http from 'k6/http';

const base = Number(__ENV.BASE_RATE || 60);
const sale = Number(__ENV.SALE_RATE || 300);
const saleSeconds = Number(__ENV.SALE_SECONDS || 3);
const saleAt = Number(__ENV.SALE_AT || 10);
const duration = Number(__ENV.DURATION || 30);
const seats = Number(__ENV.SEATS || 4);
const url = __ENV.URL || 'http://localhost:9080/api/reservations';

const arrivals = (rate, seconds, startTime) => ({
    executor: 'constant-arrival-rate',
    rate,
    timeUnit: '1s',
    duration: `${seconds}s`,
    startTime: `${startTime}s`,
    preAllocatedVUs: 2000,
    maxVUs: 6000,
});

export const options = {
    scenarios: {
        steady: arrivals(base, duration, 0),
        sale: arrivals(sale, saleSeconds, saleAt),
    },
    summaryTrendStats: ['med', 'p(99)', 'max'],
};

const body = JSON.stringify({ show: 1, seats });
const params = { headers: { 'Content-Type': 'application/json' }, timeout: '60s' };

export default function () {
    http.post(url, body, params);
}
