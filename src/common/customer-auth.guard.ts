import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Request } from 'express';
import { LoggerService } from './logger.service';

export interface CustomerAuthUser {
  id?: string;
  email: string;
  roles: string[];
}

@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { customerAuth?: CustomerAuthUser }>();
    const token = this.readBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Customer bearer token is required');
    }

    const authBaseUrl = (process.env.AUTH_SERVICE_URL || process.env.AUTH_INTERNAL_URL || '').trim().replace(/\/+$/, '');
    if (!authBaseUrl) {
      throw new UnauthorizedException('Customer auth is not configured');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${authBaseUrl}/auth/validate`, {
          token,
        }, {
          timeout: 3000,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const user = response.data?.user;
      const email = this.normalizeEmail(user?.email);
      if (!response.data?.valid || !email) {
        throw new ForbiddenException('Customer invoice scope is unavailable');
      }

      request.customerAuth = {
        id: typeof user.id === 'string' ? user.id : undefined,
        email,
        roles: Array.isArray(user.roles) ? user.roles.filter((role: unknown): role is string => typeof role === 'string') : [],
      };
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn('Customer auth validation failed', 'CustomerAuthGuard', {
        reason: 'auth_validate_failed',
      });
      throw new UnauthorizedException('Invalid customer bearer token');
    }
  }

  private readBearerToken(request: Request): string | null {
    const authHeader = request.header('authorization')?.trim();
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      return null;
    }
    const token = authHeader.slice(7).trim();
    return token || null;
  }

  private normalizeEmail(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return normalized.includes('@') ? normalized : null;
  }
}
