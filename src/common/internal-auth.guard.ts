import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { INVOICES_INTERNAL_ROLES_KEY } from './roles.decorator';

type AuthValidateResponse = {
  valid?: boolean;
  user?: {
    id?: string;
    sub?: string;
    email?: string;
    roles?: unknown;
  };
};

/**
 * Auth RS256 gate for invoices internal / service-to-service routes.
 * Bearer only → POST /auth/validate + explicit @Roles. Static
 * INVOICES_INTERNAL_SERVICE_TOKEN / x-internal-service-token deleted.
 */
@Injectable()
export class InternalAuthGuard implements CanActivate {
  private readonly authServiceUrl = (
    process.env.AUTH_SERVICE_URL ||
    process.env.AUTH_INTERNAL_URL ||
    'http://auth-microservice:3370'
  ).replace(/\/+$/, '');
  private readonly authValidateTimeoutMs = Number(process.env.AUTH_VALIDATE_TIMEOUT_MS || 3000);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(INVOICES_INTERNAL_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      const handlerName = `${context.getClass().name}.${context.getHandler().name}`;
      console.error(
        `[InternalAuthGuard] ${handlerName} is guarded but declares no @Roles; denying.`,
      );
      throw new ForbiddenException('Route has no declared role requirement');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header('authorization')?.trim();
    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = authorization.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const user = await this.validateBearer(token);
    const roles = Array.isArray(user.roles)
      ? user.roles.filter((role): role is string => typeof role === 'string')
      : [];

    if (!requiredRoles.some((role) => roles.includes(role))) {
      throw new ForbiddenException('Principal lacks the required role');
    }

    (request as Request & { user?: unknown }).user = {
      id: user.id || user.sub,
      email: user.email,
      roles,
    };
    return true;
  }

  private async validateBearer(token: string): Promise<NonNullable<AuthValidateResponse['user']>> {
    const controller = new AbortController();
    const timeoutMs =
      Number.isFinite(this.authValidateTimeoutMs) && this.authValidateTimeoutMs > 0
        ? this.authValidateTimeoutMs
        : 3000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.authServiceUrl}/auth/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        signal: controller.signal,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'invoices_internal_auth_validate_unreachable',
          message: 'Auth validate unreachable during internal route check',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw new UnauthorizedException('Invalid token');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new UnauthorizedException('Invalid token');
    }

    let validation: AuthValidateResponse;
    try {
      validation = (await response.json()) as AuthValidateResponse;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    if (!validation.valid || !validation.user) {
      throw new UnauthorizedException('Invalid token');
    }

    return validation.user;
  }
}
