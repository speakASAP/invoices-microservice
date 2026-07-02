import { InvoicePdfService } from '../src/invoices/invoice-pdf.service';
import { InvoiceDocument, InvoiceStatus, InvoiceType } from '../src/invoices/entities/invoice-document.entity';

describe('InvoicePdfService', () => {
  it('renders a stable PDF buffer with checksum and safe filename', async () => {
    const service = new InvoicePdfService();
    const invoice = {
      id: 'invoice-1',
      type: InvoiceType.FINAL,
      invoiceNumber: 'FV/2026 000001',
      status: InvoiceStatus.DELIVERY_PENDING,
      orderId: 'order-1',
      issuedAt: new Date('2026-07-02T12:00:00.000Z'),
    } as InvoiceDocument;

    const pdf = await service.render({
      invoice,
      seller: {
        name: 'Statex Seller',
        address: 'Seller Street 1',
        taxId: 'CZ123',
      },
      order: {
        id: 'order-1',
        currency: 'CZK',
        subtotal: 100,
        shippingCost: 0,
        taxAmount: 21,
        total: 121,
        customer: { name: 'Customer' },
        billingAddress: { name: 'Customer', street: 'Billing 1', city: 'Prague', country: 'CZ' },
        items: [{ productName: 'Product', quantity: 1, unitPrice: 100, totalPrice: 100 }],
      },
    });

    expect(pdf.content.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.content.length).toBeGreaterThan(1000);
    expect(pdf.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(pdf.mimeType).toBe('application/pdf');
    expect(pdf.filename).toBe('tax-invoice-FV-2026-000001.pdf');
  });
});
