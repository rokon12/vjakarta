package ca.bazlur.tickets;

import jakarta.annotation.Resource;
import jakarta.enterprise.concurrent.ManagedExecutorService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.event.Startup;
import jakarta.inject.Inject;
import jakarta.ws.rs.ProcessingException;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.TimeoutException;
import java.util.logging.Logger;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static java.util.concurrent.TimeUnit.MILLISECONDS;

@ApplicationScoped
public class Reservations {

    private static final Logger log = Logger.getLogger(Reservations.class.getName());

    @Resource(lookup = "java:app/concurrent/seat-holds")
    ManagedExecutorService seatHoldExecutor;

    @Resource(lookup = "java:app/concurrent/payments")
    ManagedExecutorService paymentExecutor;

    @Inject
    SeatHolds seatHolds;

    @Inject
    Payments payments;

    @Inject
    @ConfigProperty(name = "reservation.deadline.millis", defaultValue = "500")
    long deadlineMillis;

    public CompletionStage<Reservation> reserve(ReservationRequest request) {
        var id = UUID.randomUUID();
        var started = System.nanoTime();
        var holds = IntStream.range(0, request.seats())
                .mapToObj(seat -> seatHoldExecutor.runAsync(() -> seatHolds.hold(id, request.show(), seat)));
        var payment = paymentExecutor.runAsync(() -> pay(id, request.seats(), started));

        var parts = Stream.concat(holds, Stream.of(payment)).toArray(CompletableFuture[]::new);
        return CompletableFuture.allOf(parts)
                .orTimeout(deadlineMillis, MILLISECONDS)
                .whenComplete((done, failure) -> {
                    if (failure instanceof TimeoutException) {
                        trace(started, "timed out, customer told to try again");
                        Stream.of(parts).forEach(part -> part.cancel(true));
                    }
                })
                .thenApply(done -> new Reservation(id, request.seats()));
    }

    private void pay(UUID id, int seats, long started) {
        trace(started, "charging card");
        try {
            payments.charge(id, seats * 4_500);
            trace(started, "card charged");
        } catch (ProcessingException e) {
            trace(started, "payment call cancelled");
            throw e;
        }
    }

    private void trace(long started, String event) {
        log.fine(() -> "%5d ms  %s".formatted((System.nanoTime() - started) / 1_000_000, event));
    }

    void report(@Observes Startup startup) {
        seatHoldExecutor.execute(() -> log.info("reservation tasks run on virtual threads: " + Thread.currentThread().isVirtual()));
    }
}
