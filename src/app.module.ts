import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from './database.module';
import { HealthController } from './health.controller';
import { InvoicesModule } from './invoices/invoices.module';
import { RabbitMqOrdersConsumer } from './events/rabbitmq-orders.consumer';
import { LoggerService } from './common/logger.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    HttpModule,
    DatabaseModule,
    InvoicesModule,
  ],
  controllers: [HealthController],
  providers: [LoggerService, RabbitMqOrdersConsumer],
})
export class AppModule {}
