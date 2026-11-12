import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

final int limit = Integer.getInteger("limit", 20);
final int millis = Integer.getInteger("millis", 50);

final Semaphore running = new Semaphore(limit);
final AtomicInteger charged = new AtomicInteger();
final AtomicInteger refused = new AtomicInteger();
final AtomicInteger repeats = new AtomicInteger();
final Map<String, CompletableFuture<Void>> charges = new ConcurrentHashMap<>();

void main() throws Exception {
    var server = HttpServer.create(new InetSocketAddress(9095), 4096);
    server.createContext("/charges", this::charge);
    server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
    server.start();
    IO.println("payment provider on :9095, %d charges at a time, %d ms each".formatted(limit, millis));

    while (true) {
        Thread.sleep(1000);
        IO.println("%2d running   %4d charged   %4d refused   %4d already charged"
                .formatted(limit - running.availablePermits(), charged.getAndSet(0), refused.getAndSet(0), repeats.getAndSet(0)));
    }
}

void charge(HttpExchange exchange) throws IOException {
    try (exchange) {
        exchange.getRequestBody().readAllBytes();
        if (!running.tryAcquire()) {
            refused.incrementAndGet();
            exchange.sendResponseHeaders(429, -1);
            return;
        }
        var key = exchange.getRequestHeaders().getFirst("Idempotency-Key");
        var charge = new CompletableFuture<Void>();
        var earlier = key == null ? null : charges.putIfAbsent(key, charge);
        if (earlier != null) {
            running.release();
            repeats.incrementAndGet();
            exchange.sendResponseHeaders(earlier.isDone() ? 201 : 409, -1);
            return;
        }
        try {
            Thread.sleep(millis);
            charged.incrementAndGet();
            charge.complete(null);
            exchange.sendResponseHeaders(201, -1);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            running.release();
        }
    }
}
