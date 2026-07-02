import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvoicesTables20260702120000 implements MigrationInterface {
  name = 'CreateInvoicesTables20260702120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE invoice_document_type AS ENUM ('proforma', 'final');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE invoice_document_status AS ENUM ('blocked', 'issued', 'delivery_pending', 'sent');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE invoice_event_record_status AS ENUM ('processed', 'skipped', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS invoice_sequence_counters (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        type invoice_document_type NOT NULL,
        year integer NOT NULL,
        "nextNumber" integer NOT NULL DEFAULT 1,
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT uq_invoice_sequence_type_year UNIQUE (type, year)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS invoice_documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "orderId" varchar(255) NOT NULL,
        type invoice_document_type NOT NULL,
        "invoiceNumber" varchar(50),
        status invoice_document_status NOT NULL DEFAULT 'blocked',
        currency varchar(3),
        "totalAmount" numeric(12,2),
        "taxAmount" numeric(12,2),
        "paymentReferenceId" varchar(255),
        "sourceEventId" varchar(255),
        "sourceEventType" varchar(100),
        "sourceOccurredAt" timestamp,
        "orderSnapshot" jsonb,
        "paymentSnapshot" jsonb,
        "documentHtml" text,
        "documentPdf" bytea,
        "documentPdfSha256" varchar(64),
        "documentMimeType" varchar(100),
        "documentFilename" varchar(255),
        "documentObjectBucket" varchar(255),
        "documentObjectKey" text,
        "documentObjectSha256" varchar(64),
        "documentObjectEtag" varchar(255),
        "documentObjectSize" bigint,
        "documentStoredAt" timestamp,
        "downloadTokenHash" varchar(128),
        "blockedReason" text,
        "issuedAt" timestamp,
        "sentAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT uq_invoice_documents_order_type UNIQUE ("orderId", type),
        CONSTRAINT uq_invoice_documents_invoice_number UNIQUE ("invoiceNumber")
      )
    `);
    await queryRunner.query('ALTER TABLE invoice_documents ADD COLUMN IF NOT EXISTS "documentPdf" bytea');
    await queryRunner.query('ALTER TABLE invoice_documents ADD COLUMN IF NOT EXISTS "documentPdfSha256" varchar(64)');
    await queryRunner.query('ALTER TABLE invoice_documents ADD COLUMN IF NOT EXISTS "documentMimeType" varchar(100)');
    await queryRunner.query('ALTER TABLE invoice_documents ADD COLUMN IF NOT EXISTS "documentFilename" varchar(255)');
    await queryRunner.query('ALTER TABLE invoice_documents ADD COLUMN IF NOT EXISTS "documentObjectBucket" varchar(255)');
    await queryRunner.query('ALTER TABLE invoice_documents ADD COLUMN IF NOT EXISTS "documentObjectKey" text');
    await queryRunner.query('ALTER TABLE invoice_documents ADD COLUMN IF NOT EXISTS "documentObjectSha256" varchar(64)');
    await queryRunner.query('ALTER TABLE invoice_documents ADD COLUMN IF NOT EXISTS "documentObjectEtag" varchar(255)');
    await queryRunner.query('ALTER TABLE invoice_documents ADD COLUMN IF NOT EXISTS "documentObjectSize" bigint');
    await queryRunner.query('ALTER TABLE invoice_documents ADD COLUMN IF NOT EXISTS "documentStoredAt" timestamp');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_invoice_documents_order_id ON invoice_documents ("orderId")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_invoice_documents_status ON invoice_documents (status)');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_invoice_documents_object_key ON invoice_documents ("documentObjectBucket", "documentObjectKey") WHERE "documentObjectKey" IS NOT NULL');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS invoice_event_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sourceEventId" varchar(255) NOT NULL UNIQUE,
        "eventType" varchar(100) NOT NULL,
        "orderId" varchar(255),
        status invoice_event_record_status NOT NULL,
        error text,
        "processedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_invoice_event_records_order_id ON invoice_event_records ("orderId")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS invoice_event_records');
    await queryRunner.query('DROP TABLE IF EXISTS invoice_documents');
    await queryRunner.query('DROP TABLE IF EXISTS invoice_sequence_counters');
    await queryRunner.query('DROP TYPE IF EXISTS invoice_event_record_status');
    await queryRunner.query('DROP TYPE IF EXISTS invoice_document_status');
    await queryRunner.query('DROP TYPE IF EXISTS invoice_document_type');
  }
}
