import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { join } from 'path';
import { InvoiceDocument } from './invoices/entities/invoice-document.entity';
import { InvoiceEventRecord } from './invoices/entities/invoice-event-record.entity';
import { InvoiceSequenceCounter } from './invoices/entities/invoice-sequence-counter.entity';
import { ensureDatabaseExistsFromEnv } from './database-bootstrap';

const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [InvoiceDocument, InvoiceEventRecord, InvoiceSequenceCounter],
  migrations: [
    join(process.cwd(), 'dist/src/migrations/*.js'),
    join(process.cwd(), 'src/migrations/*.ts'),
  ],
  migrationsRun: process.env.DB_MIGRATIONS_RUN !== 'false',
  synchronize: process.env.DB_SYNC === 'true',
  logging: process.env.NODE_ENV === 'development',
};

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        await ensureDatabaseExistsFromEnv();
        return dataSourceOptions;
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
