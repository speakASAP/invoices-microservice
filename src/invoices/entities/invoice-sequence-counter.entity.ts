import { Column, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { InvoiceType } from './invoice-document.entity';

@Entity('invoice_sequence_counters')
@Unique('uq_invoice_sequence_type_year', ['type', 'year'])
export class InvoiceSequenceCounter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: InvoiceType })
  type: InvoiceType;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int', default: 1 })
  nextNumber: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
