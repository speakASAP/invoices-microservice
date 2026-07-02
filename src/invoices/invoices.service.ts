import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import {
  InvoiceDocument,
  InvoiceStatus,
  InvoiceType,
} from './entities/invoice-document.entity';
import {
  InvoiceEventRecord,
  InvoiceEventRecordStatus,
} from './entities/invoice-event-record.entity';
import {
  ORDERS_EVENT_TYPES,
  validateOrdersEventEnvelope,
  VerifiedOrdersEvent,
} from './orders-event.dto';
import { InvoiceNumberingService } from './invoice-numbering.service';
import { OrdersClientService } from './orders-client.service';
import { PaymentsClientService } from './payments-client.service';
import { NotificationsClientService } from './notifications-client.service';
import { InvoiceTemplateService } from './invoice-template.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceOrderSnapshot, SellerSnapshot } from './order-snapshot.types';
import { LoggerService } from '../common/logger.service';

export type OrdersEventHandlingResult =
  | { action: 'ignored'; reason: string }
  | { action: 'deduped'; eventId: string }
  | { action: 'blocked'; invoiceId: string; reason: string }
  | { action: 'issued'; invoiceId: string; invoiceNumber: string | null; status: InvoiceStatus };

export interface InvoiceDownloadLinks {
  downloadUrl: string;
  htmlUrl: string;
  pdfUrl: string | null;
}

export interface CustomerInvoiceIdentity {
  id?: string | null;
  subject?: string | null;
  email?: string | null;
}

export interface InvoicePdfDocument {
  content: Buffer;
  mimeType: string;
  filename: string;
  sha256: string | null;
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(InvoiceDocument)
    private readonly invoiceRepository: Repository<InvoiceDocument>,
    @InjectRepository(InvoiceEventRecord)
    private readonly eventRepository: Repository<InvoiceEventRecord>,
    private readonly numbering: InvoiceNumberingService,
    private readonly ordersClient: OrdersClientService,
    private readonly paymentsClient: PaymentsClientService,
    private readonly notificationsClient: NotificationsClientService,
    private readonly template: InvoiceTemplateService,
    private readonly pdf: InvoicePdfService,
    private readonly logger: LoggerService,
  ) {}

  async handleOrdersEvent(input: unknown): Promise<OrdersEventHandlingResult> {
    const validation = validateOrdersEventEnvelope(input);
    if (validation.valid === false) {
      this.logger.warn('Ignored invalid Orders event', 'InvoicesService', { reason: validation.reason });
      return { action: 'ignored', reason: validation.reason };
    }

    const event = validation.event;
    const existingEvent = await this.eventRepository.findOne({ where: { sourceEventId: event.eventId } });
    if (existingEvent?.status === InvoiceEventRecordStatus.PROCESSED || existingEvent?.status === InvoiceEventRecordStatus.SKIPPED) {
      return { action: 'deduped', eventId: event.eventId };
    }

    try {
      const result = await this.routeVerifiedEvent(event);
      await this.eventRepository.save(this.eventRepository.create({
        ...(existingEvent || {}),
        sourceEventId: event.eventId,
        eventType: event.type,
        orderId: event.payload.orderId,
        status: result.action === 'ignored' ? InvoiceEventRecordStatus.SKIPPED : InvoiceEventRecordStatus.PROCESSED,
        error: null,
        processedAt: new Date(),
      }));
      return result;
    } catch (error) {
      await this.eventRepository.save(this.eventRepository.create({
        ...(existingEvent || {}),
        sourceEventId: event.eventId,
        eventType: event.type,
        orderId: event.payload.orderId,
        status: InvoiceEventRecordStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
        processedAt: new Date(),
      }));
      throw error;
    }
  }

  async findByOrder(orderId: string): Promise<InvoiceDocument[]> {
    return this.invoiceRepository.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
  }

  async findByCustomerEmail(email: string): Promise<InvoiceDocument[]> {
    return this.findByCustomerIdentity({ email });
  }

  async findByCustomerIdentity(identity: CustomerInvoiceIdentity): Promise<InvoiceDocument[]> {
    const normalized = this.normalizeCustomerIdentity(identity);
    if (!normalized) return [];

    return this.invoiceRepository.createQueryBuilder('invoice')
      .where(this.customerIdentityWhereClause(), normalized)
      .orderBy('invoice.createdAt', 'ASC')
      .getMany();
  }

  async createCustomerDownloadLinks(invoiceId: string, email: string): Promise<InvoiceDownloadLinks | null> {
    return this.createCustomerDownloadLinksForIdentity(invoiceId, { email });
  }

  async createCustomerDownloadLinksForIdentity(
    invoiceId: string,
    identity: CustomerInvoiceIdentity,
  ): Promise<InvoiceDownloadLinks | null> {
    const normalized = this.normalizeCustomerIdentity(identity);
    if (!normalized) return null;

    const invoice = await this.invoiceRepository.createQueryBuilder('invoice')
      .where('invoice.id = :invoiceId', { invoiceId })
      .andWhere(`(${this.customerIdentityWhereClause()})`, normalized)
      .getOne();

    if (!invoice?.documentHtml) {
      return null;
    }

    return this.rotateDownloadLinks(invoice);
  }

  async createCustomerDownloadLink(invoiceId: string, email: string): Promise<string | null> {
    const links = await this.createCustomerDownloadLinks(invoiceId, email);
    return links?.downloadUrl || null;
  }

  async getDocumentHtml(invoiceId: string, token: string): Promise<string | null> {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice?.documentHtml || !invoice.downloadTokenHash || !this.verifyToken(token, invoice.downloadTokenHash)) {
      return null;
    }
    return invoice.documentHtml;
  }

  async getInternalDocumentHtml(invoiceId: string): Promise<string | null> {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    return invoice?.documentHtml || null;
  }

  async getDocumentPdf(invoiceId: string, token: string): Promise<InvoicePdfDocument | null> {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice?.documentPdf || !invoice.downloadTokenHash || !this.verifyToken(token, invoice.downloadTokenHash)) {
      return null;
    }
    return this.toPdfDocument(invoice);
  }

  async getInternalDocumentPdf(invoiceId: string): Promise<InvoicePdfDocument | null> {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice?.documentPdf) {
      return null;
    }
    return this.toPdfDocument(invoice);
  }

  async createDownloadLinks(invoiceId: string): Promise<InvoiceDownloadLinks | null> {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice?.documentHtml) {
      return null;
    }

    return this.rotateDownloadLinks(invoice);
  }

  async createDownloadLink(invoiceId: string): Promise<string | null> {
    const links = await this.createDownloadLinks(invoiceId);
    return links?.downloadUrl || null;
  }

  private async routeVerifiedEvent(event: VerifiedOrdersEvent): Promise<OrdersEventHandlingResult> {
    if (event.type === ORDERS_EVENT_TYPES.created) {
      return this.issueInvoiceForEvent(InvoiceType.PROFORMA, event);
    }
    if (event.type === ORDERS_EVENT_TYPES.paid) {
      return this.issueInvoiceForEvent(InvoiceType.FINAL, event);
    }
    return { action: 'ignored', reason: 'unsupported_event_type' };
  }

  private async issueInvoiceForEvent(type: InvoiceType, event: VerifiedOrdersEvent): Promise<OrdersEventHandlingResult> {
    const orderId = event.payload.orderId;
    const existing = await this.invoiceRepository.findOne({ where: { orderId, type } });
    if (existing && existing.status !== InvoiceStatus.BLOCKED) {
      return {
        action: 'issued',
        invoiceId: existing.id,
        invoiceNumber: existing.invoiceNumber,
        status: existing.status,
      };
    }

    let order: InvoiceOrderSnapshot;
    try {
      order = await this.ordersClient.fetchOrderSnapshot(orderId);
    } catch {
      const blocked = await this.saveBlockedInvoice(type, event, existing, 'order_snapshot_unavailable');
      return { action: 'blocked', invoiceId: blocked.id, reason: blocked.blockedReason || 'order_snapshot_unavailable' };
    }

    const seller = this.resolveSeller();
    const blockers = this.validateIssuanceInputs(type, order, seller);
    if (blockers.length > 0) {
      const blocked = await this.saveBlockedInvoice(type, event, existing, blockers.join(','));
      return { action: 'blocked', invoiceId: blocked.id, reason: blocked.blockedReason || 'invoice_input_blocked' };
    }

    const paymentSnapshot = type === InvoiceType.FINAL
      ? await this.paymentsClient.fetchPaymentSnapshot(order.paymentApplicationId, order.id)
      : null;

    const issuedAt = new Date();
    const token = this.generateDownloadToken();
    const invoice = await this.invoiceRepository.manager.transaction(async (manager) => {
      let record = existing || await manager.findOne(InvoiceDocument, { where: { orderId, type } });
      if (!record) {
        record = manager.create(InvoiceDocument, { orderId, type });
      }

      record.invoiceNumber = record.invoiceNumber || await this.numbering.allocate(type, issuedAt, manager);
      record.status = InvoiceStatus.DELIVERY_PENDING;
      record.currency = order.currency || 'CZK';
      record.totalAmount = this.decimalString(order.total);
      record.taxAmount = this.decimalString(order.taxAmount);
      record.paymentReferenceId = type === InvoiceType.FINAL
        ? String((event.payload as any).paymentReferenceId || order.paymentReferenceId || '')
        : null;
      record.sourceEventId = event.eventId;
      record.sourceEventType = event.type;
      record.sourceOccurredAt = new Date(event.occurredAt);
      record.orderSnapshot = this.toStoredOrderSnapshot(order);
      record.paymentSnapshot = paymentSnapshot;
      record.blockedReason = null;
      record.issuedAt = issuedAt;
      record.downloadTokenHash = this.hashToken(token);
      record.documentHtml = this.template.render({ invoice: record, order, seller });
      const pdf = await this.pdf.render({ invoice: record, order, seller });
      record.documentPdf = pdf.content;
      record.documentPdfSha256 = pdf.sha256;
      record.documentMimeType = pdf.mimeType;
      record.documentFilename = pdf.filename;
      return manager.save(InvoiceDocument, record);
    });

    const links = this.buildDownloadLinks(invoice.id, token);
    const sent = await this.notificationsClient.sendInvoiceReady({
      invoice,
      recipient: this.resolveRecipient(order),
      downloadUrl: links?.pdfUrl || links?.htmlUrl,
      pdfDownloadUrl: links?.pdfUrl || undefined,
    });

    if (sent) {
      invoice.status = InvoiceStatus.SENT;
      invoice.sentAt = new Date();
      await this.invoiceRepository.save(invoice);
    }

    this.logger.log('Invoice issued', 'InvoicesService', {
      orderId: invoice.orderId,
      invoiceType: invoice.type,
      status: invoice.status,
    });

    return {
      action: 'issued',
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
    };
  }

  private async saveBlockedInvoice(
    type: InvoiceType,
    event: VerifiedOrdersEvent,
    existing: InvoiceDocument | null,
    reason: string,
  ): Promise<InvoiceDocument> {
    const record = existing || this.invoiceRepository.create({
      orderId: event.payload.orderId,
      type,
    });
    record.status = InvoiceStatus.BLOCKED;
    record.sourceEventId = event.eventId;
    record.sourceEventType = event.type;
    record.sourceOccurredAt = new Date(event.occurredAt);
    record.orderSnapshot = {
      orderId: event.payload.orderId,
      eventPayload: event.payload,
    };
    record.blockedReason = reason;
    const saved = await this.invoiceRepository.save(record);
    this.logger.warn('Invoice issuance blocked', 'InvoicesService', {
      orderId: saved.orderId,
      invoiceType: saved.type,
      reason,
    });
    return saved;
  }

  private validateIssuanceInputs(type: InvoiceType, order: InvoiceOrderSnapshot, seller: SellerSnapshot | null): string[] {
    const blockers: string[] = [];
    if (!seller) blockers.push('seller_legal_config_missing');
    if (!order.id) blockers.push('order_id_missing');
    if (!order.currency) blockers.push('order_currency_missing');
    if (order.total === undefined || order.total === null) blockers.push('order_total_missing');

    const billing = order.billingAddress || {};
    const customer = order.customer || {};
    if (!billing.companyName && !billing.name && !customer.name) blockers.push('buyer_name_missing');
    if (!billing.street && !billing.city && !billing.country) blockers.push('buyer_billing_address_missing');
    if (type === InvoiceType.FINAL && order.paymentStatus && order.paymentStatus !== 'paid') {
      blockers.push('order_not_paid');
    }
    return blockers;
  }

  private resolveSeller(): SellerSnapshot | null {
    const name = process.env.INVOICE_SELLER_NAME?.trim();
    const address = process.env.INVOICE_SELLER_ADDRESS?.trim();
    if (!name || !address) return null;
    return {
      name,
      address,
      companyId: process.env.INVOICE_SELLER_COMPANY_ID?.trim() || undefined,
      taxId: process.env.INVOICE_SELLER_TAX_ID?.trim() || undefined,
      vatId: process.env.INVOICE_SELLER_VAT_ID?.trim() || undefined,
      email: process.env.INVOICE_SELLER_EMAIL?.trim() || undefined,
    };
  }

  private resolveRecipient(order: InvoiceOrderSnapshot): string | undefined {
    return order.customer?.email || undefined;
  }

  private async rotateDownloadLinks(invoice: InvoiceDocument): Promise<InvoiceDownloadLinks | null> {
    const token = this.generateDownloadToken();
    const links = this.buildDownloadLinks(invoice.id, token);
    if (!links) return null;
    invoice.downloadTokenHash = this.hashToken(token);
    await this.invoiceRepository.save(invoice);
    return links;
  }

  private buildDownloadUrl(invoiceId: string, token: string): string | undefined {
    return this.buildDocumentUrl(invoiceId, 'html', token);
  }

  private buildPdfDownloadUrl(invoiceId: string, token: string): string | undefined {
    return this.buildDocumentUrl(invoiceId, 'pdf', token);
  }

  private buildDownloadLinks(invoiceId: string, token: string): InvoiceDownloadLinks | null {
    const htmlUrl = this.buildDownloadUrl(invoiceId, token);
    if (!htmlUrl) return null;
    return {
      downloadUrl: htmlUrl,
      htmlUrl,
      pdfUrl: this.buildPdfDownloadUrl(invoiceId, token) || null,
    };
  }

  private buildDocumentUrl(invoiceId: string, extension: 'html' | 'pdf', token: string): string | undefined {
    const base = process.env.INVOICES_PUBLIC_BASE_URL?.trim()?.replace(/\/+$/, '');
    if (!base) return undefined;
    return `${base}/documents/${encodeURIComponent(invoiceId)}.${extension}?token=${encodeURIComponent(token)}`;
  }

  private toPdfDocument(invoice: InvoiceDocument): InvoicePdfDocument {
    const content = Buffer.isBuffer(invoice.documentPdf)
      ? invoice.documentPdf
      : Buffer.from(invoice.documentPdf as unknown as Uint8Array);
    return {
      content,
      mimeType: invoice.documentMimeType || 'application/pdf',
      filename: invoice.documentFilename || this.pdf.filenameFor(invoice),
      sha256: invoice.documentPdfSha256,
    };
  }

  private toStoredOrderSnapshot(order: InvoiceOrderSnapshot): Record<string, unknown> {
    return {
      id: order.id,
      channel: order.channel,
      customerId: order.customerId,
      customerUserId: order.customerUserId,
      authUserId: order.authUserId,
      userId: order.userId,
      status: order.status,
      currency: order.currency,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      taxAmount: order.taxAmount,
      total: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      paymentReferenceId: order.paymentReferenceId,
      paymentApplicationId: order.paymentApplicationId,
      paymentUpdatedAt: order.paymentUpdatedAt,
      customer: order.customer,
      billingAddress: order.billingAddress,
      shippingAddress: order.shippingAddress,
      items: order.items,
      orderedAt: order.orderedAt,
      createdAt: order.createdAt,
    };
  }

  private decimalString(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return numeric.toFixed(2);
  }

  private normalizeCustomerIdentity(identity: CustomerInvoiceIdentity): { subject: string | null; email: string | null } | null {
    const subject = this.normalizeSubject(identity.subject) || this.normalizeSubject(identity.id);
    const email = this.normalizeEmail(identity.email);
    if (!subject && !email) return null;
    return { subject, email };
  }

  private customerIdentityWhereClause(): string {
    return [
      'LOWER("invoice"."orderSnapshot" #>> \'{customer,id}\') = :subject',
      'LOWER("invoice"."orderSnapshot" #>> \'{customer,userId}\') = :subject',
      'LOWER("invoice"."orderSnapshot" #>> \'{customer,authUserId}\') = :subject',
      'LOWER("invoice"."orderSnapshot" #>> \'{customer,subject}\') = :subject',
      'LOWER("invoice"."orderSnapshot" #>> \'{customer,sub}\') = :subject',
      'LOWER("invoice"."orderSnapshot" #>> \'{customerId}\') = :subject',
      'LOWER("invoice"."orderSnapshot" #>> \'{customerUserId}\') = :subject',
      'LOWER("invoice"."orderSnapshot" #>> \'{authUserId}\') = :subject',
      'LOWER("invoice"."orderSnapshot" #>> \'{userId}\') = :subject',
      'LOWER("invoice"."orderSnapshot" #>> \'{customer,email}\') = :email',
    ].map((condition) => `(${condition})`).join(' OR ');
  }

  private normalizeEmail(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return normalized.includes('@') ? normalized : null;
  }

  private normalizeSubject(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return normalized || null;
  }

  private generateDownloadToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private verifyToken(token: string, expectedHash: string): boolean {
    if (!token || !expectedHash) return false;
    const actual = Buffer.from(this.hashToken(token), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
