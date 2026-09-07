import { SetMetadata } from '@nestjs/common';

export const INVOICES_INTERNAL_ROLES_KEY = 'invoices:internal-roles';

/**
 * Declares which Auth roles may call an InternalAuthGuard route.
 *
 * Seed / mint via auth-microservice/scripts/provision-service-token.js:
 *   - internal:invoices-microservice:read
 *   - internal:invoices-microservice:write
 *   - internal:invoices-microservice:service  (accepted on read+write)
 *
 * A guarded handler without this decorator is denied (fail closed).
 */
export const Roles = (...roles: string[]) =>
  SetMetadata(INVOICES_INTERNAL_ROLES_KEY, roles);
