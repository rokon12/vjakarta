package ca.bazlur.tickets;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.ext.Provider;
import org.eclipse.microprofile.metrics.MetricUnits;
import org.eclipse.microprofile.metrics.annotation.Gauge;

import java.util.concurrent.atomic.AtomicInteger;

@Provider
@ApplicationScoped
public class InFlight implements ContainerRequestFilter, ContainerResponseFilter {

    private final AtomicInteger requests = new AtomicInteger();

    @Override
    public void filter(ContainerRequestContext request) {
        requests.incrementAndGet();
    }

    @Override
    public void filter(ContainerRequestContext request, ContainerResponseContext response) {
        requests.decrementAndGet();
    }

    @Gauge(name = "in_flight", unit = MetricUnits.NONE, absolute = true)
    public int inFlight() {
        return requests.get();
    }
}
