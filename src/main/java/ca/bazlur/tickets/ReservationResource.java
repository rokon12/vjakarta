package ca.bazlur.tickets;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.UUID;
import java.util.concurrent.CompletionException;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.TimeoutException;

import static jakarta.ws.rs.core.Response.Status.BAD_GATEWAY;
import static jakarta.ws.rs.core.Response.Status.CREATED;
import static jakarta.ws.rs.core.Response.Status.GATEWAY_TIMEOUT;

@Path("/reservations")
public class ReservationResource {

    @Inject
    Reservations reservations;

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public CompletionStage<Response> reserve(ReservationRequest request, @HeaderParam("Idempotency-Key") UUID key) {
        return reservations.reserve(request, key == null ? UUID.randomUUID() : key)
                .thenApply(reservation -> Response.status(CREATED).entity(reservation).build())
                .exceptionally(ReservationResource::failed);
    }

    private static Response failed(Throwable failure) {
        var cause = failure instanceof CompletionException ? failure.getCause() : failure;
        return Response.status(cause instanceof TimeoutException ? GATEWAY_TIMEOUT : BAD_GATEWAY).build();
    }
}
