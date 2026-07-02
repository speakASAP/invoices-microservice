import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum InvoiceEventRecordStatus {
  PROCESSED = 'processed',
  SKIPPED = 'skipped',
  FAILED = 'failed',
}

@Entity('invoice_event_records')
@Index('idx_invoice_event_records_order_id', ['orderId'])
export class InvoiceEventRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  sourceEventId: string;

  @Column({ type: 'varchar', length: 100 })
  eventType: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  orderId: string | null;

  @Column({ type: 'enum', enum: InvoiceEventRecordStatus })
  status: InvoiceEventRecordStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
