import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export enum InvoiceType {
  PROFORMA = 'proforma',
  FINAL = 'final',
}

export enum InvoiceStatus {
  BLOCKED = 'blocked',
  ISSUED = 'issued',
  DELIVERY_PENDING = 'delivery_pending',
  SENT = 'sent',
}

@Entity('invoice_documents')
@Unique('uq_invoice_documents_order_type', ['orderId', 'type'])
@Index('idx_invoice_documents_order_id', ['orderId'])
@Index('idx_invoice_documents_status', ['status'])
export class InvoiceDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  orderId: string;

  @Column({ type: 'enum', enum: InvoiceType })
  type: InvoiceType;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  invoiceNumber: string | null;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.BLOCKED })
  status: InvoiceStatus;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalAmount: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  taxAmount: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentReferenceId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sourceEventId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sourceEventType: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sourceOccurredAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  orderSnapshot: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  paymentSnapshot: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  documentHtml: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  downloadTokenHash: string | null;

  @Column({ type: 'text', nullable: true })
  blockedReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  issuedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
