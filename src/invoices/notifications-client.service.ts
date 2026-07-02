import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { LoggerService } from '../common/logger.service';
import { InvoiceDocument, InvoiceType } from './entities/invoice-document.entity';

@Injectable()
export class NotificationsClientService {
  constructor(
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
  ) {}

  async sendInvoiceReady(input: {
    invoice: InvoiceDocument;
    recipient?: string;
    downloadUrl?: string;
  }): Promise<boolean> {
    const baseUrl = process.env.NOTIFICATIONS_SERVICE_URL?.trim()?.replace(/\/+$/, '');
    const token = process.env.NOTIFICATIONS_SERVICE_TOKEN?.trim();
    if (!baseUrl || !token || !input.recipient || !input.downloadUrl) {
      return false;
    }

    const label = input.invoice.type === InvoiceType.PROFORMA ? 'Proforma invoice' : 'Final tax invoice';
    try {
      await firstValueFrom(
        this.httpService.post(`${baseUrl}/notifications/send`, {
          channel: 'email',
          type: input.invoice.type === InvoiceType.PROFORMA ? 'order_confirmation' : 'payment_confirmation',
          recipient: input.recipient,
          subject: `${label} ${input.invoice.invoiceNumber}`,
          message: `${label} ${input.invoice.invoiceNumber} is ready: ${input.downloadUrl}`,
          service: 'invoices-microservice',
          purpose: 'transactional',
          channelKey: process.env.INVOICES_NOTIFICATION_CHANNEL_KEY || 'invoices.documents',
          templateData: {
            invoice: {
              id: input.invoice.id,
              type: input.invoice.type,
              invoiceNumber: input.invoice.invoiceNumber,
              orderId: input.invoice.orderId,
            },
          },
        }, {
          timeout: 10000,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      );
      return true;
    } catch {
      this.logger.warn('Invoice notification send failed', 'NotificationsClientService', {
        orderId: input.invoice.orderId,
        invoiceType: input.invoice.type,
      });
      return false;
    }
  }
}
