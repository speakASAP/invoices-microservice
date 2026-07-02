import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { LoggerService } from '../common/logger.service';

@Injectable()
export class PaymentsClientService {
  constructor(
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
  ) {}

  async fetchPaymentSnapshot(applicationId: string | undefined, orderId: string): Promise<Record<string, unknown> | null> {
    const baseUrl = process.env.PAYMENTS_SERVICE_URL?.trim()?.replace(/\/+$/, '');
    const apiKey = process.env.PAYMENTS_API_KEY?.trim();
    if (!baseUrl || !apiKey || !applicationId) {
      return null;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/payments/status/by-order-id`, {
          timeout: 10000,
          params: { applicationId, orderId },
          headers: { 'X-API-Key': apiKey },
        }),
      );
      const data = response.data?.data || response.data;
      if (!data) return null;
      return {
        paymentId: data.paymentId,
        orderId: data.orderId,
        applicationId: data.applicationId,
        status: data.status,
        amount: data.amount,
        currency: data.currency,
        paymentMethod: data.paymentMethod,
        completedAt: data.completedAt || null,
        source: data.source || 'payments_db_snapshot',
        providerCall: false,
      };
    } catch {
      this.logger.warn('Payments snapshot read skipped after failure', 'PaymentsClientService', { orderId, reason: 'payment_snapshot_unavailable' });
      return null;
    }
  }
}
