import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const configured = process.env.INVOICES_INTERNAL_SERVICE_TOKEN?.trim();
    if (!configured) {
      throw new UnauthorizedException('Internal service token is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = this.readProvidedToken(request);
    if (!provided || !this.safeEqual(provided, configured)) {
      throw new UnauthorizedException('Invalid internal service token');
    }
    return true;
  }

  private readProvidedToken(request: Request): string | null {
    const internalHeader = request.header('x-internal-service-token')?.trim();
    if (internalHeader) return internalHeader;

    const authHeader = request.header('authorization')?.trim();
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      return authHeader.slice(7).trim();
    }
    return null;
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }
}
