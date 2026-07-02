import { of, throwError } from 'rxjs';
import { LoggerService } from '../src/common/logger.service';

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe('LoggerService logging-microservice contract', () => {
  const originalLoggingUrl = process.env.LOGGING_SERVICE_URL;
  const originalLoggingInternalUrl = process.env.LOGGING_SERVICE_INTERNAL_URL;
  const originalLoggingPath = process.env.LOGGING_SERVICE_API_PATH;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    restoreEnv('LOGGING_SERVICE_URL', originalLoggingUrl);
    restoreEnv('LOGGING_SERVICE_INTERNAL_URL', originalLoggingInternalUrl);
    restoreEnv('LOGGING_SERVICE_API_PATH', originalLoggingPath);
    restoreEnv('NODE_ENV', originalNodeEnv);
    jest.restoreAllMocks();
  });

  it('posts sanitized invoice logs to logging-microservice', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOGGING_SERVICE_URL = 'http://logging-microservice:3367';
    process.env.LOGGING_SERVICE_API_PATH = '/api/logs';
    const httpService = {
      post: jest.fn(() => of({ data: { success: true } })),
    };
    const logger = new LoggerService(httpService as any);

    logger.log(
      'Invoice ready for person@example.test token=raw-token Bearer raw.bearer',
      'InvoicesService',
      {
        orderId: 'order-1',
        invoiceType: 'final',
        status: 'sent',
        customerEmail: 'person@example.test',
        downloadToken: 'raw-token',
        apiKey: 'raw-api-key',
        address: 'Buyer Street 1',
      },
    );

    expect(httpService.post).toHaveBeenCalledWith(
      'http://logging-microservice:3367/api/logs',
      expect.objectContaining({
        level: 'info',
        message: 'Invoice ready for [redacted-email] token=[redacted] Bearer [redacted]',
        service: 'invoices-microservice',
        timestamp: expect.any(String),
        metadata: {
          orderId: 'order-1',
          invoiceType: 'final',
          status: 'sent',
          customerEmail: '[redacted]',
          downloadToken: '[redacted]',
          apiKey: '[redacted]',
          address: '[redacted]',
          context: 'InvoicesService',
        },
      }),
      expect.objectContaining({
        timeout: 2000,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const payload = (httpService.post as jest.Mock).mock.calls[0][1];
    expect(JSON.stringify(payload)).not.toContain('person@example.test');
    expect(JSON.stringify(payload)).not.toContain('raw-token');
    expect(JSON.stringify(payload)).not.toContain('raw-api-key');
  });

  it('does not fail invoice flow when remote logging is unavailable', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOGGING_SERVICE_URL = 'http://logging-microservice:3367';
    const httpService = {
      post: jest.fn(() => throwError(() => new Error('logging unavailable'))),
    };
    const logger = new LoggerService(httpService as any);

    expect(() => logger.warn('Invoice delivery retry scheduled', 'InvoicesService', { orderId: 'order-1' })).not.toThrow();

    expect(httpService.post).toHaveBeenCalledWith(
      'http://logging-microservice:3367/api/logs',
      expect.objectContaining({
        level: 'warn',
        message: 'Invoice delivery retry scheduled',
        service: 'invoices-microservice',
      }),
      expect.any(Object),
    );
  });

  it('keeps local logging disabled when no logging URL is configured', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.LOGGING_SERVICE_URL;
    delete process.env.LOGGING_SERVICE_INTERNAL_URL;
    const httpService = {
      post: jest.fn(),
    };
    const logger = new LoggerService(httpService as any);

    logger.log('Invoice issued', 'InvoicesService', { orderId: 'order-1' });

    expect(httpService.post).not.toHaveBeenCalled();
  });
});
