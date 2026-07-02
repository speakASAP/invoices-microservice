import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { InvoiceType } from './entities/invoice-document.entity';
import { InvoiceSequenceCounter } from './entities/invoice-sequence-counter.entity';

@Injectable()
export class InvoiceNumberingService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async allocate(type: InvoiceType, issuedAt: Date, manager?: EntityManager): Promise<string> {
    const year = issuedAt.getUTCFullYear();
    if (manager) {
      return this.allocateWithManager(manager, type, year);
    }
    return this.dataSource.transaction((transactionManager) => this.allocateWithManager(transactionManager, type, year));
  }

  private async allocateWithManager(manager: EntityManager, type: InvoiceType, year: number): Promise<string> {
    let counter = await manager.findOne(InvoiceSequenceCounter, {
      where: { type, year },
      lock: { mode: 'pessimistic_write' },
    });

    if (!counter) {
      counter = manager.create(InvoiceSequenceCounter, {
        type,
        year,
        nextNumber: 1,
      });
      counter = await manager.save(InvoiceSequenceCounter, counter);
    }

    const current = counter.nextNumber;
    counter.nextNumber += 1;
    await manager.save(InvoiceSequenceCounter, counter);

    return `${this.prefix(type)}-${year}-${String(current).padStart(6, '0')}`;
  }

  private prefix(type: InvoiceType): string {
    return type === InvoiceType.PROFORMA ? 'PF' : 'INV';
  }
}
