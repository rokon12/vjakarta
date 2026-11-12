package ca.bazlur.tickets;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.concurrent.CompletionStage;

import static jakarta.ws.rs.core.Response.Status.BAD_GATEWAY;
import static jakarta.ws.rs.core.Response.Status.CREATED;

@Path("/reservations")
public class ReservationResource {

    @Inject
    Reservations reservations;

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public CompletionStage<Response> reserve(ReservationRequest request) {
        return reservations.reserve(request)
                .thenApply(reservation -> Response.status(CREATED).entity(reservation).build())
                .exceptionally(failure -> Response.status(BAD_GATEWAY).build());
    }
}
