import { InvoicesService } from '../src/invoices/invoices.service';
import { InvoiceDocument, InvoiceStatus, InvoiceType } from '../src/invoices/entities/invoice-document.entity';
import { InvoiceEventRecordStatus } from '../src/invoices/entities/invoice-event-record.entity';

describe('InvoicesService issuance', () => {
  const originalPublicBaseUrl = process.env.INVOICES_PUBLIC_BASE_URL;
  const originalSellerName = process.env.INVOICE_SELLER_NAME;
  const originalSellerAddress = process.env.INVOICE_SELLER_ADDRESS;

  afterEach(() => {
    process.env.INVOICES_PUBLIC_BASE_URL = originalPublicBaseUrl;
    process.env.INVOICE_SELLER_NAME = originalSellerName;
    process.env.INVOICE_SELLER_ADDRESS = originalSellerAddress;
    jest.restoreAllMocks();
  });

  it('stores PDF bytes and sends the PDF download URL when issuing a proforma', async () => {
    process.env.INVOICES_PUBLIC_BASE_URL = 'https://invoices.example.test';
    process.env.INVOICE_SELLER_NAME = 'Statex Seller';
    process.env.INVOICE_SELLER_ADDRESS = 'Seller Street 1';
    const savedInvoices: InvoiceDocument[] = [];
    const manager = {
      findOne: jest.fn(async () => null),
      create: jest.fn((_entity: unknown, data: Partial<InvoiceDocument>) => ({
        ...data,
        id: 'invoice-1',
      })),
      save: jest.fn(async (_entity: unknown, record: InvoiceDocument) => {
        savedInvoices.push(record);
        return record;
      }),
    };
    const invoiceRepository = {
      findOne: jest.fn(async () => null),
      create: jest.fn((data: Partial<InvoiceDocument>) => ({ ...data, id: 'invoice-1' })),
      manager: {
        transaction: jest.fn(async (callback: (manager: any) => Promise<InvoiceDocument>) => callback(manager)),
      },
    };
    const eventRepository = {
      findOne: jest.fn(async () => null),
      create: jest.fn((data: Record<string, unknown>) => data),
      save: jest.fn(async (record: Record<string, unknown>) => record),
    };
    const notificationsClient = {
      sendInvoiceReady: jest.fn(async () => false),
    };
    const service = new InvoicesService(
      invoiceRepository as any,
      eventRepository as any,
      { allocate: jest.fn(async () => 'PF-2026-000001') } as any,
      {
        fetchOrderSnapshot: jest.fn(async () => ({
          id: 'order-1',
          currency: 'CZK',
          subtotal: 100,
          shippingCost: 0,
          taxAmount: 21,
          total: 121,
          customer: { email: 'person@example.test', name: 'Person' },
          billingAddress: { name: 'Person', street: 'Billing 1', city: 'Prague', country: 'CZ' },
          items: [{ productName: 'Product', quantity: 1, unitPrice: 100, totalPrice: 100 }],
        })),
      } as any,
      { fetchPaymentSnapshot: jest.fn() } as any,
      notificationsClient as any,
      { render: jest.fn(() => '<html>invoice</html>') } as any,
      {
        render: jest.fn(async () => ({
          content: Buffer.from('%PDF invoice'),
          sha256: 'a'.repeat(64),
          mimeType: 'application/pdf',
          filename: 'proforma-invoice-PF-2026-000001.pdf',
        })),
        filenameFor: jest.fn(() => 'proforma-invoice-PF-2026-000001.pdf'),
      } as any,
      { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any,
    );

    const result = await service.handleOrdersEvent({
      eventVersion: 1,
      eventId: 'evt-1',
      type: 'orders.order.created.v1',
      occurredAt: '2026-07-02T12:00:00.000Z',
      source: 'orders-microservice',
      payload: { orderId: 'order-1', channel: 'flipflop', currency: 'CZK' },
    });

    expect(result).toEqual({
      action: 'issued',
      invoiceId: 'invoice-1',
      invoiceNumber: 'PF-2026-000001',
      status: InvoiceStatus.DELIVERY_PENDING,
    });
    expect(savedInvoices[0]).toMatchObject({
      type: InvoiceType.PROFORMA,
      documentHtml: '<html>invoice</html>',
      documentPdf: Buffer.from('%PDF invoice'),
      documentPdfSha256: 'a'.repeat(64),
      documentMimeType: 'application/pdf',
      documentFilename: 'proforma-invoice-PF-2026-000001.pdf',
    });
    expect(notificationsClient.sendInvoiceReady).toHaveBeenCalledWith(expect.objectContaining({
      downloadUrl: expect.stringMatching(/^https:\/\/invoices\.example\.test\/documents\/invoice-1\.pdf\?token=/),
      pdfDownloadUrl: expect.stringMatching(/^https:\/\/invoices\.example\.test\/documents\/invoice-1\.pdf\?token=/),
    }));
    expect(eventRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      sourceEventId: 'evt-1',
      eventType: 'orders.order.created.v1',
      orderId: 'order-1',
      status: InvoiceEventRecordStatus.PROCESSED,
    }));
  });
});
