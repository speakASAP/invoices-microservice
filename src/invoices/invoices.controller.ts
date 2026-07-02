import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { InvoicesService } from './invoices.service';
import { InvoiceDocument } from './entities/invoice-document.entity';

@Controller()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('invoices/order/:orderId')
  @UseGuards(InternalAuthGuard)
  async findByOrder(@Param('orderId') orderId: string) {
    const invoices = await this.invoicesService.findByOrder(orderId);
    return {
      success: true,
      data: invoices.map((invoice) => this.toSafeInvoice(invoice)),
    };
  }

  @Post('invoices/events/orders')
  @UseGuards(InternalAuthGuard)
  async ingestOrdersEvent(@Body() body: unknown) {
    const result = await this.invoicesService.handleOrdersEvent(body);
    return { success: true, data: result };
  }

  @Get('documents/:invoiceId.html')
  async getDocument(
    @Param('invoiceId') invoiceId: string,
    @Query('token') token: string,
    @Res() response: Response,
  ) {
    const html = await this.invoicesService.getDocumentHtml(invoiceId, token);
    if (!html) {
      throw new ForbiddenException('Invalid document token');
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.send(html);
  }

  private toSafeInvoice(invoice: InvoiceDocument) {
    return {
      id: invoice.id,
      orderId: invoice.orderId,
      type: invoice.type,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      currency: invoice.currency,
      totalAmount: invoice.totalAmount,
      taxAmount: invoice.taxAmount,
      paymentReferenceId: invoice.paymentReferenceId,
      sourceEventId: invoice.sourceEventId,
      sourceEventType: invoice.sourceEventType,
      sourceOccurredAt: invoice.sourceOccurredAt,
      blockedReason: invoice.blockedReason,
      issuedAt: invoice.issuedAt,
      sentAt: invoice.sentAt,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }
}
