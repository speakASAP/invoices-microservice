import { Body, Controller, ForbiddenException, Get, Header, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { CustomerAuthGuard, CustomerAuthUser } from '../common/customer-auth.guard';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { InvoicesService } from './invoices.service';
import { InvoiceDocument } from './entities/invoice-document.entity';

type CustomerRequest = Request & { customerAuth?: CustomerAuthUser };

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

  @Get('invoices/account')
  @UseGuards(CustomerAuthGuard)
  async findForAccount(@Req() request: CustomerRequest) {
    const customer = this.requireCustomer(request);
    const invoices = await this.invoicesService.findByCustomerEmail(customer.email);
    return {
      success: true,
      data: invoices.map((invoice) => this.toAccountInvoice(invoice)),
    };
  }

  @Post('invoices/account/:invoiceId/download-link')
  @UseGuards(CustomerAuthGuard)
  async createAccountDownloadLink(
    @Param('invoiceId') invoiceId: string,
    @Req() request: CustomerRequest,
  ) {
    const customer = this.requireCustomer(request);
    const links = await this.invoicesService.createCustomerDownloadLinks(invoiceId, customer.email);
    if (!links) {
      throw new ForbiddenException('Invoice download link is not available');
    }
    return {
      success: true,
      data: { invoiceId, ...links },
    };
  }

  @Get('invoices/:invoiceId/document.html')
  @UseGuards(InternalAuthGuard)
  async getInternalDocument(
    @Param('invoiceId') invoiceId: string,
    @Res() response: Response,
  ) {
    const html = await this.invoicesService.getInternalDocumentHtml(invoiceId);
    if (!html) {
      throw new ForbiddenException('Invoice document is not available');
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.send(html);
  }

  @Get('invoices/:invoiceId/document.pdf')
  @UseGuards(InternalAuthGuard)
  @Header('Content-Type', 'application/pdf')
  async getInternalPdfDocument(
    @Param('invoiceId') invoiceId: string,
    @Res() response: Response,
  ) {
    const pdf = await this.invoicesService.getInternalDocumentPdf(invoiceId);
    if (!pdf) {
      throw new ForbiddenException('Invoice PDF document is not available');
    }
    this.sendPdf(response, pdf);
  }

  @Post('invoices/:invoiceId/download-link')
  @UseGuards(InternalAuthGuard)
  async createDownloadLink(@Param('invoiceId') invoiceId: string) {
    const links = await this.invoicesService.createDownloadLinks(invoiceId);
    if (!links) {
      throw new ForbiddenException('Invoice download link is not available');
    }
    return {
      success: true,
      data: {
        invoiceId,
        ...links,
      },
    };
  }

  @Get('documents/:invoiceId.html')
  async getPublicDocument(
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

  @Get('documents/:invoiceId.pdf')
  @Header('Content-Type', 'application/pdf')
  async getPublicPdfDocument(
    @Param('invoiceId') invoiceId: string,
    @Query('token') token: string,
    @Res() response: Response,
  ) {
    const pdf = await this.invoicesService.getDocumentPdf(invoiceId, token);
    if (!pdf) {
      throw new ForbiddenException('Invalid document token');
    }
    this.sendPdf(response, pdf);
  }

  private requireCustomer(request: CustomerRequest): CustomerAuthUser {
    if (!request.customerAuth) {
      throw new ForbiddenException('Customer invoice scope is unavailable');
    }
    return request.customerAuth;
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

  private toAccountInvoice(invoice: InvoiceDocument) {
    return {
      id: invoice.id,
      orderId: invoice.orderId,
      type: invoice.type,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      currency: invoice.currency,
      totalAmount: invoice.totalAmount,
      taxAmount: invoice.taxAmount,
      issuedAt: invoice.issuedAt,
      sentAt: invoice.sentAt,
      createdAt: invoice.createdAt,
      documentAvailable: Boolean(invoice.documentHtml),
      pdfAvailable: Boolean(invoice.documentPdf),
      documentMimeType: invoice.documentMimeType,
    };
  }

  private sendPdf(response: Response, pdf: { content: Buffer; mimeType: string; filename: string }) {
    response.setHeader('Content-Type', pdf.mimeType);
    response.setHeader('Content-Disposition', `inline; filename="${pdf.filename}"`);
    response.send(pdf.content);
  }
}
