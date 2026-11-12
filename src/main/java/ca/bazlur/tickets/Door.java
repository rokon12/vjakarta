package ca.bazlur.tickets;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.metrics.Counter;
import org.eclipse.microprofile.metrics.annotation.Metric;

import java.util.concurrent.Semaphore;

import static jakarta.ws.rs.core.Response.Status.SERVICE_UNAVAILABLE;

@Provider
@Priority(Priorities.USER + 100)
@ApplicationScoped
public class Door implements ContainerRequestFilter, ContainerResponseFilter {

    @Inject
    @ConfigProperty(name = "door.limit")
    int limit;

    @Inject
    @Metric(name = "door_refused")
    Counter refused;

    private Semaphore inside;

    @PostConstruct
    void open() {
        inside = new Semaphore(limit);
    }

    @Override
    public void filter(ContainerRequestContext request) {
        if (inside.tryAcquire()) {
            request.setProperty("inside", true);
        } else {
            refused.inc();
            request.abortWith(Response.status(SERVICE_UNAVAILABLE).header("Retry-After", 1).build());
        }
    }

    @Override
    public void filter(ContainerRequestContext request, ContainerResponseContext response) {
        if (request.getProperty("inside") != null) {
            inside.release();
        }
    }
}
