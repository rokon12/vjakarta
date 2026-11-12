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

    @Resource(lookup = "java:app/concurrent/reservations")
    ManagedExecutorService executor;

    @Inject
    SeatHolds seatHolds;

    @Inject
    Payments payments;

    public CompletionStage<Reservation> reserve(ReservationRequest request) {
        var id = UUID.randomUUID();
        var holds = IntStream.range(0, request.seats())
                .mapToObj(seat -> executor.runAsync(() -> seatHolds.hold(id, request.show(), seat)));
        var payment = executor.runAsync(() -> payments.charge(id, request.seats() * 4_500));

        var parts = Stream.concat(holds, Stream.of(payment)).toArray(CompletableFuture[]::new);
        return CompletableFuture.allOf(parts).thenApply(done -> new Reservation(id, request.seats()));
    }

    void report(@Observes Startup startup) {
        executor.execute(() -> log.info("reservation tasks run on virtual threads: " + Thread.currentThread().isVirtual()));
    }
}
