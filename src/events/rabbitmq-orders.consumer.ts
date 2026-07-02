import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { InvoicesService } from '../invoices/invoices.service';
import { ORDERS_EVENT_TYPES } from '../invoices/orders-event.dto';
import { LoggerService } from '../common/logger.service';

@Injectable()
export class RabbitMqOrdersConsumer implements OnModuleInit, OnModuleDestroy {
  private connection: any | null = null;
  private channel: amqp.Channel | null = null;

  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit() {
    if (process.env.ORDERS_EVENTS_CONSUMER_ENABLED !== 'true') {
      this.logger.warn('Orders events consumer disabled', 'RabbitMqOrdersConsumer');
      return;
    }

    const url = process.env.RABBITMQ_URL;
    if (!url) {
      this.logger.warn('Orders events consumer missing RABBITMQ_URL', 'RabbitMqOrdersConsumer');
      return;
    }

    const exchange = process.env.ORDERS_EVENTS_EXCHANGE || 'orders.events';
    const queue = process.env.INVOICES_ORDERS_QUEUE || 'invoices.orders.lifecycle';
    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.bindQueue(queue, exchange, ORDERS_EVENT_TYPES.created);
    await this.channel.bindQueue(queue, exchange, ORDERS_EVENT_TYPES.paid);
    await this.channel.prefetch(1);
    await this.channel.consume(queue, async (message) => {
      if (!message || !this.channel) return;
      try {
        const payload = JSON.parse(message.content.toString('utf8'));
        await this.invoicesService.handleOrdersEvent(payload);
        this.channel.ack(message);
      } catch (error) {
        this.logger.error('Orders event consume failed', error instanceof Error ? error.stack : undefined, 'RabbitMqOrdersConsumer');
        this.channel.nack(message, false, false);
      }
    });
    this.logger.log('Orders events consumer started', 'RabbitMqOrdersConsumer');
  }

  async onModuleDestroy() {
    if (this.channel) await this.channel.close().catch(() => undefined);
    if (this.connection) await this.connection.close().catch(() => undefined);
  }
}
