import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import PDFDocument = require('pdfkit');
import { InvoiceDocument, InvoiceType } from './entities/invoice-document.entity';
import { InvoiceOrderItemSnapshot, InvoiceOrderSnapshot, SellerSnapshot } from './order-snapshot.types';

export interface RenderedInvoicePdf {
  content: Buffer;
  sha256: string;
  mimeType: 'application/pdf';
  filename: string;
}

@Injectable()
export class InvoicePdfService {
  async render(input: {
    invoice: InvoiceDocument;
    order: InvoiceOrderSnapshot;
    seller: SellerSnapshot;
  }): Promise<RenderedInvoicePdf> {
    const title = input.invoice.type === InvoiceType.PROFORMA ? 'Proforma invoice' : 'Tax invoice';
    const filename = this.filenameFor(input.invoice);
    const content = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `${title} ${input.invoice.invoiceNumber || ''}`.trim(),
          Author: input.seller.name,
          Subject: `Order ${input.order.id}`,
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.writePdf(doc, title, input.invoice, input.order, input.seller);
      doc.end();
    });

    return {
      content,
      sha256: createHash('sha256').update(content).digest('hex'),
      mimeType: 'application/pdf',
      filename,
    };
  }

  filenameFor(invoice: InvoiceDocument): string {
    const prefix = invoice.type === InvoiceType.PROFORMA ? 'proforma-invoice' : 'tax-invoice';
    const number = invoice.invoiceNumber || invoice.id || 'not-issued';
    return `${prefix}-${this.safeFilenamePart(number)}.pdf`;
  }

  private writePdf(
    doc: PDFKit.PDFDocument,
    title: string,
    invoice: InvoiceDocument,
    order: InvoiceOrderSnapshot,
    seller: SellerSnapshot,
  ): void {
    const billing = order.billingAddress || {};
    const customer = order.customer || {};
    const items = this.normalizeItems(order);

    doc.fontSize(22).text(title, { continued: false });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#4b5563')
      .text(`Number: ${invoice.invoiceNumber || 'not-issued'}`)
      .text(`Issued: ${this.formatDate(invoice.issuedAt || new Date())}`)
      .text(`Order: ${order.id}`);
    doc.fillColor('#111827').moveDown();

    const left = doc.x;
    const top = doc.y;
    const right = 320;
    doc.fontSize(13).text('Seller', left, top);
    doc.fontSize(10)
      .text(seller.name, left)
      .text(seller.address, left);
    if (seller.companyId) doc.text(`Company ID: ${seller.companyId}`, left);
    if (seller.taxId) doc.text(`Tax ID: ${seller.taxId}`, left);
    if (seller.vatId) doc.text(`VAT ID: ${seller.vatId}`, left);
    if (seller.email) doc.text(seller.email, left);

    doc.fontSize(13).text('Buyer', right, top);
    doc.fontSize(10)
      .text(billing.companyName || billing.name || customer.name || 'Customer', right)
      .text(billing.street || '', right)
      .text([billing.postalCode, billing.city].filter(Boolean).join(' '), right)
      .text(billing.country || '', right);
    if (billing.taxId) doc.text(`Tax ID: ${billing.taxId}`, right);
    if (billing.vatId) doc.text(`VAT ID: ${billing.vatId}`, right);

    doc.moveDown(3);
    const tableTop = Math.max(doc.y, top + 130);
    this.row(doc, tableTop, ['Item', 'Qty', 'Unit', 'Total'], true);
    let y = tableTop + 22;
    for (const item of items) {
      this.row(doc, y, [
        this.itemLabel(item),
        String(item.quantity),
        this.money(item.unitPrice, order.currency),
        this.money(item.totalPrice, order.currency),
      ]);
      y += 22;
      if (y > 700) {
        doc.addPage();
        y = 60;
        this.row(doc, y, ['Item', 'Qty', 'Unit', 'Total'], true);
        y += 22;
      }
    }

    y += 20;
    this.summaryRow(doc, y, 'Subtotal', this.money(order.subtotal, order.currency));
    this.summaryRow(doc, y + 18, 'Shipping', this.money(order.shippingCost, order.currency));
    this.summaryRow(doc, y + 36, 'Tax', this.money(order.taxAmount, order.currency));
    doc.fontSize(12);
    this.summaryRow(doc, y + 58, 'Total', this.money(order.total, order.currency), true);
  }

  private row(doc: PDFKit.PDFDocument, y: number, values: string[], header = false): void {
    const columns = [50, 285, 350, 430];
    const widths = [220, 50, 70, 80];
    doc.fontSize(header ? 10 : 9).fillColor(header ? '#111827' : '#374151');
    values.forEach((value, index) => {
      doc.text(value || '', columns[index], y, {
        width: widths[index],
        align: index >= 2 ? 'right' : 'left',
      });
    });
    doc.moveTo(50, y + 16).lineTo(520, y + 16).strokeColor('#d1d5db').stroke();
  }

  private summaryRow(doc: PDFKit.PDFDocument, y: number, label: string, value: string, bold = false): void {
    doc.fontSize(bold ? 12 : 10).fillColor('#111827');
    doc.text(label, 330, y, { width: 100 });
    doc.text(value, 430, y, { width: 90, align: 'right' });
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
    return `${formatted} ${currency || 'CZK'}`;
  }

  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private safeFilenamePart(value: string): string {
    return String(value).trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'invoice';
  }
}
