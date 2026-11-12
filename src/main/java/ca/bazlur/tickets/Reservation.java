package ca.bazlur.tickets;

import java.util.UUID;

public record Reservation(UUID id, int seats) {
}
