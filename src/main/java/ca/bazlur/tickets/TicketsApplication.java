package ca.bazlur.tickets;

import jakarta.enterprise.concurrent.ManagedExecutorDefinition;
import jakarta.ws.rs.ApplicationPath;
import jakarta.ws.rs.core.Application;

@ApplicationPath("/api")
@ManagedExecutorDefinition(name = "java:app/concurrent/seat-holds", virtual = true, maxAsync = 20)
@ManagedExecutorDefinition(name = "java:app/concurrent/payments", virtual = true, maxAsync = 20)
public class TicketsApplication extends Application {
}
