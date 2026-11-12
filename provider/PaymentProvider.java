import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

final int limit = Integer.getInteger("limit", 20);
final int millis = Integer.getInteger("millis", 50);

final Semaphore running = new Semaphore(limit);
final AtomicInteger charged = new AtomicInteger();
final AtomicInteger refused = new AtomicInteger();

void main() throws Exception {
    var server = HttpServer.create(new InetSocketAddress(9095), 4096);
    server.createContext("/charges", this::charge);
    server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
    server.start();
    IO.println("payment provider on :9095, %d charges at a time, %d ms each".formatted(limit, millis));

    while (true) {
        Thread.sleep(1000);
        IO.println("%2d running   %4d charged   %4d refused"
                .formatted(limit - running.availablePermits(), charged.getAndSet(0), refused.getAndSet(0)));
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
        try {
            Thread.sleep(millis);
            charged.incrementAndGet();
            exchange.sendResponseHeaders(201, -1);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            running.release();
        }
    }
}
