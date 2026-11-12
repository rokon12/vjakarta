package ca.bazlur.tickets;

import jakarta.annotation.Resource;
import jakarta.enterprise.concurrent.ManagedExecutorService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.event.Startup;
import jakarta.inject.Inject;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.logging.Logger;
import java.util.stream.IntStream;
import java.util.stream.Stream;

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

    public CompletionStage<Reservation> reserve(ReservationRequest request) {
        var id = UUID.randomUUID();
        var holds = IntStream.range(0, request.seats())
                .mapToObj(seat -> seatHoldExecutor.runAsync(() -> seatHolds.hold(id, request.show(), seat)));
        var payment = paymentExecutor.runAsync(() -> payments.charge(id, request.seats() * 4_500));

        var parts = Stream.concat(holds, Stream.of(payment)).toArray(CompletableFuture[]::new);
        return CompletableFuture.allOf(parts).thenApply(done -> new Reservation(id, request.seats()));
    }

    void report(@Observes Startup startup) {
        seatHoldExecutor.execute(() -> log.info("reservation tasks run on virtual threads: " + Thread.currentThread().isVirtual()));
    }
}
