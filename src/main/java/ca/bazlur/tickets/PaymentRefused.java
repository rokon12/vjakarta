package ca.bazlur.tickets;

public class PaymentRefused extends RuntimeException {

    public PaymentRefused() {
        super("the payment provider is busy");
    }
}
