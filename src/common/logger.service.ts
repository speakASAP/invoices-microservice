import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

type LogMetadata = Record<string, string | number | boolean | null | undefined>;

const SENSITIVE_KEY_PATTERN = /(token|secret|password|authorization|cookie|address|street|email|phone|customer|providerResponse)/i;

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly serviceName = 'invoices-microservice';
  private readonly loggingServiceUrl = process.env.LOGGING_SERVICE_URL || process.env.LOGGING_SERVICE_INTERNAL_URL;
  private readonly loggingPath = process.env.LOGGING_SERVICE_API_PATH || '/api/logs';

  constructor(private readonly httpService: HttpService) {}

  log(message: string, context?: string, metadata?: LogMetadata) {
    this.emit('info', message, context, metadata);
  }

  warn(message: string, context?: string, metadata?: LogMetadata) {
    this.emit('warn', message, context, metadata);
  }

  error(message: string, trace?: string, context?: string, metadata?: LogMetadata) {
    this.emit('error', message, context, { ...(metadata || {}), trace: trace ? '[redacted-trace]' : undefined });
  }

  debug(message: string, context?: string, metadata?: LogMetadata) {
    if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development') {
      this.emit('debug', message, context, metadata);
    }
  }

  verbose(message: string, context?: string, metadata?: LogMetadata) {
    this.debug(message, context, metadata);
  }

  private emit(level: string, message: string, context?: string, metadata?: LogMetadata) {
    const safeMessage = this.sanitizeString(message);
    const safeMetadata = this.sanitizeMetadata({
      ...(metadata || {}),
      ...(context ? { context } : {}),
    });

    if (this.loggingServiceUrl) {
      firstValueFrom(
        this.httpService.post(`${this.loggingServiceUrl}${this.loggingPath}`, {
          level,
          message: safeMessage,
          service: this.serviceName,
          timestamp: new Date().toISOString(),
          metadata: safeMetadata,
        }, {
          timeout: 2000,
          headers: { 'Content-Type': 'application/json' },
        }),
      ).catch(() => undefined);
    }

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`[${level}] ${safeMessage}`, safeMetadata);
    }
  }

  private sanitizeMetadata(metadata: LogMetadata): LogMetadata {
    return Object.entries(metadata).reduce<LogMetadata>((acc, [key, value]) => {
      if (value === undefined) return acc;
      acc[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : this.sanitizeValue(value);
      return acc;
    }, {});
  }

  private sanitizeValue(value: string | number | boolean | null): string | number | boolean | null {
    if (typeof value !== 'string') return value;
    return this.sanitizeString(value);
  }

  private sanitizeString(value: string): string {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted-email]');
  }
}
