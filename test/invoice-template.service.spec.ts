import { InvoiceTemplateService } from '../src/invoices/invoice-template.service';
import { InvoiceDocument, InvoiceStatus, InvoiceType } from '../src/invoices/entities/invoice-document.entity';

describe('InvoiceTemplateService', () => {
  it('renders escaped invoice HTML', () => {
    const service = new InvoiceTemplateService();
    const invoice = {
      id: 'invoice-1',
      type: InvoiceType.PROFORMA,
      invoiceNumber: 'PF-2026-000001',
      status: InvoiceStatus.DELIVERY_PENDING,
      orderId: 'order-1',
      issuedAt: new Date('2026-07-02T12:00:00.000Z'),
    } as InvoiceDocument;

    const html = service.render({
      invoice,
      seller: {
        name: 'Statex Seller',
        address: 'Seller Street 1',
      },
      order: {
        id: 'order-1',
        currency: 'CZK',
        subtotal: 100,
        shippingCost: 0,
        taxAmount: 21,
        total: 121,
        customer: { name: '<Customer>' },
        billingAddress: { name: '<Customer>', street: 'Billing 1', city: 'Prague', country: 'CZ' },
        items: [{ productName: '<Product>', quantity: 1, unitPrice: 100, totalPrice: 100 }],
      },
    });

    expect(html).toContain('PF-2026-000001');
    expect(html).toContain('&lt;Product&gt;');
    expect(html).not.toContain('<Product>');
  });
});
