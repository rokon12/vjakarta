package ca.bazlur.tickets;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.client.Entity;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.faulttolerance.Retry;

import java.util.UUID;

@ApplicationScoped
public class Payments {

    public record Charge(UUID reservation, int cents) {
    }

    @Inject
    @ConfigProperty(name = "payments.url")
    String url;

    private Client client;

    @PostConstruct
    void open() {
        client = ClientBuilder.newClient();
    }

    @PreDestroy
    void close() {
        client.close();
    }

    @Retry(retryOn = PaymentRefused.class)
    public void charge(UUID reservation, int cents) {
        try (var response = client.target(url).request().post(Entity.json(new Charge(reservation, cents)))) {
            if (response.getStatus() == 429) {
                throw new PaymentRefused();
            }
            if (response.getStatus() != 201) {
                throw new IllegalStateException("payment failed with " + response.getStatus());
            }
        }
    }
}
