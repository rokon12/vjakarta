package ca.bazlur.tickets;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import javax.sql.DataSource;
import java.sql.SQLException;
import java.util.UUID;

@ApplicationScoped
public class SeatHolds {

    private static final String HOLD = """
            insert into holds (reservation_id, show_id, seat)
            select ?, ?, ? from pg_sleep(?)
            """;

    @Resource(lookup = "jdbc/tickets")
    DataSource tickets;

    @Inject
    @ConfigProperty(name = "seat.query.millis", defaultValue = "10")
    int queryMillis;

    public void hold(UUID reservationId, int show, int seat) {
        try (var connection = tickets.getConnection();
             var hold = connection.prepareStatement(HOLD)) {
            hold.setObject(1, reservationId);
            hold.setInt(2, show);
            hold.setInt(3, seat);
            hold.setDouble(4, queryMillis / 1000.0);
            hold.executeUpdate();
        } catch (SQLException e) {
            throw new IllegalStateException(e);
        }
    }
}
