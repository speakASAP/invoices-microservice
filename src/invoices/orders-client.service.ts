import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { LoggerService } from '../common/logger.service';
import { InvoiceOrderSnapshot } from './order-snapshot.types';

@Injectable()
export class OrdersClientService {
  constructor(
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
  ) {}

  async fetchOrderSnapshot(orderId: string): Promise<InvoiceOrderSnapshot> {
    const baseUrl = this.resolveBaseUrl();
    const token = process.env.ORDERS_SERVICE_TOKEN?.trim() || process.env.INVOICES_ORDERS_SERVICE_TOKEN?.trim();
    if (!baseUrl || !token) {
      throw new Error('ORDER_READ_CONFIG_MISSING');
    }

    const url = `${baseUrl}/api/orders/${encodeURIComponent(orderId)}`;
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          timeout: 10000,
          headers: {
            'x-internal-service-token': token,
            'x-service-name': 'invoices-microservice',
          },
        }),
      );
      const data = response.data?.data || response.data;
      if (!data?.id) {
        throw new Error('ORDER_READ_INVALID_RESPONSE');
      }
      return data as InvoiceOrderSnapshot;
    } catch (error) {
      this.logger.warn('Orders snapshot read failed', 'OrdersClientService', { orderId, reason: 'order_read_failed' });
      throw error;
    }
  }

  private resolveBaseUrl(): string | null {
    const raw = process.env.ORDERS_SERVICE_URL?.trim();
    if (!raw) return null;
    return raw.replace(/\/+$/, '');
  }
}
