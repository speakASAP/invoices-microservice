import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceDocument } from './entities/invoice-document.entity';
import { InvoiceEventRecord } from './entities/invoice-event-record.entity';
import { InvoiceSequenceCounter } from './entities/invoice-sequence-counter.entity';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoiceNumberingService } from './invoice-numbering.service';
import { OrdersClientService } from './orders-client.service';
import { PaymentsClientService } from './payments-client.service';
import { NotificationsClientService } from './notifications-client.service';
import { InvoiceTemplateService } from './invoice-template.service';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { LoggerService } from '../common/logger.service';
import { CustomerAuthGuard } from '../common/customer-auth.guard';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([InvoiceDocument, InvoiceEventRecord, InvoiceSequenceCounter]),
  ],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    InvoiceNumberingService,
    OrdersClientService,
    PaymentsClientService,
    NotificationsClientService,
    InvoiceTemplateService,
    InternalAuthGuard,
    CustomerAuthGuard,
    LoggerService,
  ],
  exports: [InvoicesService],
})
export class InvoicesModule {}
