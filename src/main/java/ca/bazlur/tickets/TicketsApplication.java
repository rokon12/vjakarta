package ca.bazlur.tickets;

import jakarta.enterprise.concurrent.ManagedExecutorDefinition;
import jakarta.ws.rs.ApplicationPath;
import jakarta.ws.rs.core.Application;

@ApplicationPath("/api")
@ManagedExecutorDefinition(name = "java:app/concurrent/reservations", maxAsync = 16)
public class TicketsApplication extends Application {
}
