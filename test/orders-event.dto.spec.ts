import {
  ORDERS_EVENT_TYPES,
  validateOrdersEventEnvelope,
} from '../src/invoices/orders-event.dto';

const baseEvent = {
  eventVersion: 1,
  eventId: 'evt-1',
  occurredAt: '2026-07-02T12:00:00.000Z',
  source: 'orders-microservice',
};

describe('orders event validation', () => {
  it('accepts order-created triggers without customer payload', () => {
    const result = validateOrdersEventEnvelope({
      ...baseEvent,
      type: ORDERS_EVENT_TYPES.created,
      payload: {
        orderId: 'order-1',
        channel: 'flipflop',
        currency: 'CZK',
        items: [{ productId: 'product-1', quantity: 1, unitPrice: 100, totalPrice: 100 }],
      },
    });

    expect(result.valid).toBe(true);
  });

  it('accepts order-paid triggers', () => {
    const result = validateOrdersEventEnvelope({
      ...baseEvent,
      type: ORDERS_EVENT_TYPES.paid,
      payload: {
        orderId: 'order-1',
        paymentStatus: 'paid',
        paymentReferenceId: 'payment-1',
      },
    });

    expect(result.valid).toBe(true);
  });

  it('rejects forbidden customer or billing payload fields', () => {
    const result = validateOrdersEventEnvelope({
      ...baseEvent,
      type: ORDERS_EVENT_TYPES.created,
      payload: {
        orderId: 'order-1',
        channel: 'flipflop',
        billingAddress: { street: 'Hidden' },
      },
    });

    expect(result.valid).toBe(false);
    if (result.valid === false) {
      expect(result.reason).toBe('payload_contains_forbidden_fields');
    }
  });
});
