import { Injectable } from '@nestjs/common';
import { InvoiceDocument, InvoiceType } from './entities/invoice-document.entity';
import { InvoiceOrderItemSnapshot, InvoiceOrderSnapshot, SellerSnapshot } from './order-snapshot.types';

@Injectable()
export class InvoiceTemplateService {
  render(input: {
    invoice: InvoiceDocument;
    order: InvoiceOrderSnapshot;
    seller: SellerSnapshot;
  }): string {
    const title = input.invoice.type === InvoiceType.PROFORMA ? 'Proforma invoice' : 'Tax invoice';
    const order = input.order;
    const billing = order.billingAddress || {};
    const customer = order.customer || {};
    const items = this.normalizeItems(order);

    return [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="utf-8">',
      `<title>${this.escape(title)} ${this.escape(input.invoice.invoiceNumber || '')}</title>`,
      '<style>',
      'body{font-family:Arial,sans-serif;color:#111827;margin:40px;line-height:1.4}',
      'h1{font-size:28px;margin:0 0 8px}',
      '.muted{color:#6b7280}',
      '.grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin:28px 0}',
      'table{width:100%;border-collapse:collapse;margin-top:24px}',
      'th,td{border-bottom:1px solid #d1d5db;padding:10px;text-align:left}',
      'th:last-child,td:last-child{text-align:right}',
      '.total{font-size:18px;font-weight:bold}',
      '</style>',
      '</head>',
      '<body>',
      `<h1>${this.escape(title)}</h1>`,
      `<div class="muted">Number: ${this.escape(input.invoice.invoiceNumber || 'not-issued')}</div>`,
      `<div class="muted">Issued: ${this.escape(this.formatDate(input.invoice.issuedAt || new Date()))}</div>`,
      `<div class="muted">Order: ${this.escape(order.id)}</div>`,
      '<div class="grid">',
      '<section>',
      '<h2>Seller</h2>',
      `<div>${this.escape(input.seller.name)}</div>`,
      `<div>${this.escape(input.seller.address)}</div>`,
      input.seller.companyId ? `<div>Company ID: ${this.escape(input.seller.companyId)}</div>` : '',
      input.seller.taxId ? `<div>Tax ID: ${this.escape(input.seller.taxId)}</div>` : '',
      input.seller.vatId ? `<div>VAT ID: ${this.escape(input.seller.vatId)}</div>` : '',
      input.seller.email ? `<div>${this.escape(input.seller.email)}</div>` : '',
      '</section>',
      '<section>',
      '<h2>Buyer</h2>',
      `<div>${this.escape(billing.companyName || billing.name || customer.name || 'Customer')}</div>`,
      billing.street ? `<div>${this.escape(billing.street)}</div>` : '',
      `<div>${this.escape([billing.postalCode, billing.city].filter(Boolean).join(' '))}</div>`,
      billing.country ? `<div>${this.escape(billing.country)}</div>` : '',
      billing.taxId ? `<div>Tax ID: ${this.escape(billing.taxId)}</div>` : '',
      billing.vatId ? `<div>VAT ID: ${this.escape(billing.vatId)}</div>` : '',
      '</section>',
      '</div>',
      '<table>',
      '<thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>',
      '<tbody>',
      ...items.map((item) => `<tr><td>${this.escape(this.itemLabel(item))}</td><td>${this.escape(String(item.quantity))}</td><td>${this.money(item.unitPrice, order.currency)}</td><td>${this.money(item.totalPrice, order.currency)}</td></tr>`),
      '</tbody>',
      '</table>',
      '<table>',
      `<tr><td>Subtotal</td><td>${this.money(order.subtotal, order.currency)}</td></tr>`,
      `<tr><td>Shipping</td><td>${this.money(order.shippingCost, order.currency)}</td></tr>`,
      `<tr><td>Tax</td><td>${this.money(order.taxAmount, order.currency)}</td></tr>`,
      `<tr class="total"><td>Total</td><td>${this.money(order.total, order.currency)}</td></tr>`,
      '</table>',
      '</body>',
      '</html>',
    ].filter(Boolean).join('');
  }

  private normalizeItems(order: InvoiceOrderSnapshot): InvoiceOrderItemSnapshot[] {
    if (Array.isArray(order.items) && order.items.length > 0) return order.items;
    return [{
      productName: 'Order total',
      quantity: 1,
      unitPrice: order.total || 0,
      totalPrice: order.total || 0,
    }];
  }

  private itemLabel(item: InvoiceOrderItemSnapshot): string {
    return item.productName || item.sku || item.productId || 'Item';
  }

  private money(value: unknown, currency = 'CZK'): string {
    const amount = Number(value || 0);
    const formatted = Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
    return `${this.escape(formatted)} ${this.escape(currency || 'CZK')}`;
  }

  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private escape(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
