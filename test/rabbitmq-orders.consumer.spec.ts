import * as amqp from 'amqplib';
import { RabbitMqOrdersConsumer } from '../src/events/rabbitmq-orders.consumer';

jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe('RabbitMqOrdersConsumer observability', () => {
  const originalEnabled = process.env.ORDERS_EVENTS_CONSUMER_ENABLED;
  const originalRabbitUrl = process.env.RABBITMQ_URL;
  let consumeHandler: (message: any) => Promise<void>;
  let channel: any;
  let connection: any;
  let invoicesService: { handleOrdersEvent: jest.Mock };
  let logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    process.env.ORDERS_EVENTS_CONSUMER_ENABLED = 'true';
    process.env.RABBITMQ_URL = 'amqp://rabbitmq';
    channel = {
      assertExchange: jest.fn(),
      assertQueue: jest.fn(),
      bindQueue: jest.fn(),
      prefetch: jest.fn(),
      consume: jest.fn((queue: string, handler: (message: any) => Promise<void>) => {
        consumeHandler = handler;
      }),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn(),
    };
    connection = {
      createChannel: jest.fn(async () => channel),
      close: jest.fn(),
    };
    (amqp.connect as jest.Mock).mockResolvedValue(connection);
    invoicesService = {
      handleOrdersEvent: jest.fn(),
    };
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  afterEach(() => {
    restoreEnv('ORDERS_EVENTS_CONSUMER_ENABLED', originalEnabled);
    restoreEnv('RABBITMQ_URL', originalRabbitUrl);
    jest.clearAllMocks();
  });

  it('warns and acknowledges ignored Orders events with routing metadata', async () => {
    invoicesService.handleOrdersEvent.mockResolvedValue({ action: 'ignored', reason: 'missing_order_id' });
    const consumer = new RabbitMqOrdersConsumer(invoicesService as any, logger as any);
    await consumer.onModuleInit();

    const message = {
      content: Buffer.from(JSON.stringify({
        type: 'orders.order.created.v1',
        eventId: 'evt-ignored',
        payload: {},
      })),
      fields: { routingKey: 'orders.order.created.v1' },
      properties: { messageId: 'message-ignored' },
    };
    await consumeHandler(message);

    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Orders event ignored by invoices consumer',
      'RabbitMqOrdersConsumer',
      expect.objectContaining({
        routingKey: 'orders.order.created.v1',
        eventType: 'orders.order.created.v1',
        eventId: 'evt-ignored',
        action: 'ignored',
        reason: 'missing_order_id',
      }),
    );
  });

  it('logs processed Orders events with event and order identifiers', async () => {
    invoicesService.handleOrdersEvent.mockResolvedValue({ action: 'issued', invoiceId: 'invoice-1', invoiceNumber: 'PF-1', status: 'delivery_pending' });
    const consumer = new RabbitMqOrdersConsumer(invoicesService as any, logger as any);
    await consumer.onModuleInit();

    const message = {
      content: Buffer.from(JSON.stringify({
        type: 'orders.order.created.v1',
        eventId: 'evt-processed',
        payload: { orderId: 'order-1' },
      })),
      fields: { routingKey: 'orders.order.created.v1' },
      properties: { messageId: 'message-processed' },
    };
    await consumeHandler(message);

    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(logger.log).toHaveBeenCalledWith(
      'Orders event consumed by invoices consumer',
      'RabbitMqOrdersConsumer',
      expect.objectContaining({
        routingKey: 'orders.order.created.v1',
        eventType: 'orders.order.created.v1',
        eventId: 'evt-processed',
        orderId: 'order-1',
        action: 'issued',
      }),
    );
  });
});
