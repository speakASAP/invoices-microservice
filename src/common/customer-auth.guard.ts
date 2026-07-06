import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Request } from 'express';
import { LoggerService } from './logger.service';

export interface CustomerAuthUser {
  id?: string;
  subject?: string;
  email?: string;
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
      const id = this.normalizeSubject(user?.id);
      const subject = this.normalizeSubject(user?.sub) || id;
      if (!response.data?.valid || (!subject && !email)) {
        throw new ForbiddenException('Customer invoice scope is unavailable');
      }

      const roles = this.readRoles(user);
      if (this.isMarathonOnlyImportedUser(user, roles)) {
        throw new ForbiddenException('Customer invoice scope is unavailable');
      }

      request.customerAuth = {
        id: id || undefined,
        subject: subject || undefined,
        email: email || undefined,
        roles,
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

  private readRoles(user: unknown): string[] {
    if (!this.isRecord(user) || !Array.isArray(user.roles)) {
      return [];
    }
    return user.roles.filter((role: unknown): role is string => typeof role === 'string');
  }

  private isMarathonOnlyImportedUser(user: unknown, roles: string[]): boolean {
    if (!this.isRecord(user)) {
      return false;
    }

    const normalizedRoles = roles.map((role) => role.trim().toLowerCase()).filter(Boolean);
    const hasMarathonMarker = normalizedRoles.some((role) => this.isMarathonRole(role))
      || this.isMarathonSource(user.source)
      || this.hasMarathonApplicationPreference(user.perApplicationPreferences);

    if (!hasMarathonMarker) {
      return false;
    }

    return !normalizedRoles.some((role) => !this.isMarathonRole(role))
      && !this.hasNonMarathonApplicationPreference(user.perApplicationPreferences);
  }

  private isMarathonRole(value: string): boolean {
    return value === 'app:marathon' || value.startsWith('app:marathon:');
  }

  private hasMarathonApplicationPreference(value: unknown): boolean {
    return this.containsMarathonMarker(value);
  }

  private hasNonMarathonApplicationPreference(value: unknown): boolean {
    return this.containsNonMarathonApplicationPreference(value);
  }

  private isMarathonApplicationKey(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    return normalized === 'marathon' || normalized === 'app:marathon' || normalized.startsWith('app:marathon:');
  }

  private containsMarathonMarker(value: unknown, depth = 0): boolean {
    if (value == null || depth > 4) {
      return false;
    }
    if (typeof value === 'string') {
      return value.toLowerCase().includes('marathon');
    }
    if (Array.isArray(value)) {
      return value.some((entry) => this.containsMarathonMarker(entry, depth + 1));
    }
    if (this.isRecord(value)) {
      return Object.entries(value).some(([key, entry]) => (
        key.toLowerCase().includes('marathon') || this.containsMarathonMarker(entry, depth + 1)
      ));
    }
    return false;
  }

  private containsNonMarathonApplicationPreference(value: unknown, depth = 0): boolean {
    if (value == null || depth > 4) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.some((entry) => this.containsNonMarathonApplicationPreference(entry, depth + 1));
    }
    if (!this.isRecord(value)) {
      return false;
    }
    return Object.entries(value).some(([key, entry]) => {
      const normalizedKey = key.trim().toLowerCase();
      if (this.isMarathonApplicationKey(normalizedKey)) {
        return false;
      }
      if (normalizedKey === 'authsources') {
        return this.isRecord(entry) && Object.entries(entry).some(([sourceKey, sourceValue]) => (
          !this.isMarathonApplicationKey(sourceKey) && this.hasPreferenceValue(sourceValue)
        ));
      }
      if (this.isApplicationPreferenceKey(normalizedKey) && this.hasPreferenceValue(entry)) {
        return true;
      }
      return this.containsNonMarathonApplicationPreference(entry, depth + 1);
    });
  }

  private isApplicationPreferenceKey(key: string): boolean {
    return key === 'invoices'
      || key === 'invoice'
      || key.startsWith('app:')
      || key.includes('microservice')
      || key.endsWith('-service')
      || key.endsWith('_service');
  }

  private hasPreferenceValue(value: unknown): boolean {
    if (value == null || value === false) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.some((entry) => this.hasPreferenceValue(entry));
    }
    if (this.isRecord(value)) {
      return Object.values(value).some((entry) => this.hasPreferenceValue(entry));
    }
    return true;
  }

  private isMarathonSource(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    const normalized = value.trim().toLowerCase();
    return normalized === 'marathon' || normalized === 'marathon-import' || normalized === 'marathon_import' || normalized === 'app:marathon';
  }

  private normalizeSubject(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return normalized || null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
