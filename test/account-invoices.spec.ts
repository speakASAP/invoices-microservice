import { of } from 'rxjs';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { CustomerAuthGuard } from '../src/common/customer-auth.guard';
import { InvoiceDocument, InvoiceStatus, InvoiceType } from '../src/invoices/entities/invoice-document.entity';
import { InvoicesService } from '../src/invoices/invoices.service';

function makeQueryBuilder(result: unknown) {
  const queryBuilder: any = {
    where: jest.fn(() => queryBuilder),
    andWhere: jest.fn(() => queryBuilder),
    orderBy: jest.fn(() => queryBuilder),
    getMany: jest.fn(async () => result),
    getOne: jest.fn(async () => result),
  };
  return queryBuilder;
}

function makeService(repository: any): InvoicesService {
  return new InvoicesService(
    repository as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { filenameFor: jest.fn(() => 'invoice.pdf') } as any,
    { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any,
  );
}

describe('account invoice access', () => {
  const originalPublicBaseUrl = process.env.INVOICES_PUBLIC_BASE_URL;

  afterEach(() => {
    process.env.INVOICES_PUBLIC_BASE_URL = originalPublicBaseUrl;
    jest.restoreAllMocks();
  });

  it('lists invoices scoped by Auth subject with email fallback', async () => {
    const invoices = [{
      id: 'invoice-1',
      orderId: 'order-1',
      type: InvoiceType.PROFORMA,
      status: InvoiceStatus.SENT,
      documentHtml: '<html></html>',
    }] as InvoiceDocument[];
    const queryBuilder = makeQueryBuilder(invoices);
    const repository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    const service = makeService(repository);

    await expect(service.findByCustomerIdentity({
      subject: ' Auth-User-1 ',
      email: ' Person@Example.Test ',
    })).resolves.toBe(invoices);

    expect(repository.createQueryBuilder).toHaveBeenCalledWith('invoice');
    const [whereClause, params] = queryBuilder.where.mock.calls[0];
    expect(whereClause).toContain('#>> \'{customer,authUserId}\'');
    expect(whereClause).toContain('#>> \'{authUserId}\'');
    expect(whereClause).toContain('#>> \'{customer,email}\'');
    expect(params).toEqual({ subject: 'auth-user-1', email: 'person@example.test' });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('invoice.createdAt', 'ASC');
  });

  it('does not query account invoices without a usable customer email', async () => {
    const repository = {
      createQueryBuilder: jest.fn(),
    };
    const service = makeService(repository);

    await expect(service.findByCustomerEmail('missing-email')).resolves.toEqual([]);

    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('keeps legacy email-only account lookup for existing order snapshots', async () => {
    const invoices = [{
      id: 'invoice-1',
      orderId: 'order-1',
      type: InvoiceType.PROFORMA,
      status: InvoiceStatus.SENT,
      documentHtml: '<html></html>',
    }] as InvoiceDocument[];
    const queryBuilder = makeQueryBuilder(invoices);
    const repository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    const service = makeService(repository);

    await expect(service.findByCustomerEmail(' Person@Example.Test ')).resolves.toBe(invoices);

    const params = queryBuilder.where.mock.calls[0][1];
    expect(params).toEqual({ subject: null, email: 'person@example.test' });
  });

  it('rotates a customer download link without exposing the token hash', async () => {
    process.env.INVOICES_PUBLIC_BASE_URL = 'https://invoices.example.test';
    const invoice = {
      id: 'invoice-1',
      orderId: 'order-1',
      type: InvoiceType.FINAL,
      status: InvoiceStatus.SENT,
      documentHtml: '<html></html>',
      downloadTokenHash: null,
    } as InvoiceDocument;
    const queryBuilder = makeQueryBuilder(invoice);
    const repository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      save: jest.fn(async (record: InvoiceDocument) => record),
    };
    const service = makeService(repository);

    const links = await service.createCustomerDownloadLinksForIdentity('invoice-1', {
      id: 'auth-user-1',
      email: 'person@example.test',
    });

    expect(links?.downloadUrl).toMatch(/^https:\/\/invoices\.example\.test\/documents\/invoice-1\.html\?token=/);
    expect(links?.htmlUrl).toMatch(/^https:\/\/invoices\.example\.test\/documents\/invoice-1\.html\?token=/);
    expect(links?.pdfUrl).toMatch(/^https:\/\/invoices\.example\.test\/documents\/invoice-1\.pdf\?token=/);
    expect(invoice.downloadTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(links?.downloadUrl).not.toContain(invoice.downloadTokenHash as string);
    const [whereClause, params] = queryBuilder.andWhere.mock.calls[0];
    expect(whereClause).toContain('#>> \'{customer,id}\'');
    expect(whereClause).toContain('#>> \'{customer,email}\'');
    expect(params).toEqual({ subject: 'auth-user-1', email: 'person@example.test' });
    expect(repository.save).toHaveBeenCalledWith(invoice);
  });

  it('refuses customer download links when no matching document is available', async () => {
    const queryBuilder = makeQueryBuilder(null);
    const repository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      save: jest.fn(),
    };
    const service = makeService(repository);

    await expect(service.createCustomerDownloadLink('invoice-1', 'person@example.test')).resolves.toBeNull();

    expect(repository.save).not.toHaveBeenCalled();
  });
});

describe('CustomerAuthGuard', () => {
  const originalAuthUrl = process.env.AUTH_SERVICE_URL;

  afterEach(() => {
    process.env.AUTH_SERVICE_URL = originalAuthUrl;
    jest.restoreAllMocks();
  });

  it('validates a bearer token through Auth and attaches normalized customer identity', async () => {
    process.env.AUTH_SERVICE_URL = 'http://auth-microservice:3370/';
    const httpService = {
      post: jest.fn(() => of({
        data: {
          valid: true,
          user: {
            id: 'user-1',
            sub: 'Auth-User-1',
            email: ' Person@Example.Test ',
            roles: ['customer', 42],
          },
        },
      })),
    };
    const guard = new CustomerAuthGuard(httpService as any, { warn: jest.fn() } as any);
    const request: any = {
      header: jest.fn((name: string) => (name.toLowerCase() === 'authorization' ? 'Bearer customer-token' : undefined)),
    };
    const context: any = {
      switchToHttp: () => ({ getRequest: () => request }),
    };

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(httpService.post).toHaveBeenCalledWith(
      'http://auth-microservice:3370/auth/validate',
      { token: 'customer-token' },
      expect.objectContaining({
        timeout: 3000,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(request.customerAuth).toEqual({
      id: 'user-1',
      subject: 'auth-user-1',
      email: 'person@example.test',
      roles: ['customer'],
    });
  });

  it('accepts a valid Auth subject even when email is unavailable', async () => {
    process.env.AUTH_SERVICE_URL = 'http://auth-microservice:3370';
    const httpService = {
      post: jest.fn(() => of({ data: { valid: true, user: { sub: 'auth-user-1', roles: ['customer'] } } })),
    };
    const guard = new CustomerAuthGuard(httpService as any, { warn: jest.fn() } as any);
    const request: any = {
      header: jest.fn((name: string) => (name.toLowerCase() === 'authorization' ? 'Bearer customer-token' : undefined)),
    };
    const context: any = { switchToHttp: () => ({ getRequest: () => request }) };

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.customerAuth).toEqual({ id: undefined, subject: 'auth-user-1', email: undefined, roles: ['customer'] });
  });

  it('rejects marathon-only imported Auth users', async () => {
    process.env.AUTH_SERVICE_URL = 'http://auth-microservice:3370';
    const httpService = {
      post: jest.fn(() => of({
        data: {
          valid: true,
          user: {
            sub: 'auth-user-1',
            email: 'person@example.test',
            roles: ['app:marathon:admin'],
            source: 'marathon-import',
            perApplicationPreferences: { marathon: { imported: true } },
          },
        },
      })),
    };
    const guard = new CustomerAuthGuard(httpService as any, { warn: jest.fn() } as any);
    const request: any = {
      header: jest.fn((name: string) => (name.toLowerCase() === 'authorization' ? 'Bearer customer-token' : undefined)),
    };
    const context: any = { switchToHttp: () => ({ getRequest: () => request }) };

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(request.customerAuth).toBeUndefined();
  });

  it('rejects nested authSources marathon-only Auth users', async () => {
    process.env.AUTH_SERVICE_URL = 'http://auth-microservice:3370';
    const httpService = {
      post: jest.fn(() => of({
        data: {
          valid: true,
          user: {
            sub: 'auth-user-1',
            roles: [],
            perApplicationPreferences: { authSources: { marathon: { source: 'marathon' } } },
          },
        },
      })),
    };
    const guard = new CustomerAuthGuard(httpService as any, { warn: jest.fn() } as any);
    const request: any = {
      header: jest.fn((name: string) => (name.toLowerCase() === 'authorization' ? 'Bearer customer-token' : undefined)),
    };
    const context: any = { switchToHttp: () => ({ getRequest: () => request }) };

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(request.customerAuth).toBeUndefined();
  });

  it('accepts marathon-linked Auth users with a non-marathon role', async () => {
    process.env.AUTH_SERVICE_URL = 'http://auth-microservice:3370';
    const httpService = {
      post: jest.fn(() => of({
        data: {
          valid: true,
          user: {
            sub: 'auth-user-1',
            roles: ['app:marathon:user', 'customer'],
            source: 'marathon-import',
            perApplicationPreferences: { marathon: { imported: true } },
          },
        },
      })),
    };
    const guard = new CustomerAuthGuard(httpService as any, { warn: jest.fn() } as any);
    const request: any = {
      header: jest.fn((name: string) => (name.toLowerCase() === 'authorization' ? 'Bearer customer-token' : undefined)),
    };
    const context: any = { switchToHttp: () => ({ getRequest: () => request }) };

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.customerAuth).toEqual({
      id: undefined,
      subject: 'auth-user-1',
      email: undefined,
      roles: ['app:marathon:user', 'customer'],
    });
  });

  it('accepts marathon-linked Auth users with a platform admin role', async () => {
    process.env.AUTH_SERVICE_URL = 'http://auth-microservice:3370';
    const httpService = {
      post: jest.fn(() => of({
        data: {
          valid: true,
          user: {
            sub: 'auth-user-1',
            roles: ['app:marathon:admin', 'platform:admin'],
            source: 'marathon-import',
            perApplicationPreferences: { marathon: { imported: true } },
          },
        },
      })),
    };
    const guard = new CustomerAuthGuard(httpService as any, { warn: jest.fn() } as any);
    const request: any = {
      header: jest.fn((name: string) => (name.toLowerCase() === 'authorization' ? 'Bearer customer-token' : undefined)),
    };
    const context: any = { switchToHttp: () => ({ getRequest: () => request }) };

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.customerAuth).toEqual({
      id: undefined,
      subject: 'auth-user-1',
      email: undefined,
      roles: ['app:marathon:admin', 'platform:admin'],
    });
  });

  it('accepts marathon-linked Auth users with non-marathon application preferences', async () => {
    process.env.AUTH_SERVICE_URL = 'http://auth-microservice:3370';
    const httpService = {
      post: jest.fn(() => of({
        data: {
          valid: true,
          user: {
            sub: 'auth-user-1',
            roles: ['app:marathon:user'],
            perApplicationPreferences: {
              marathon: { imported: true },
              invoices: { enabled: true },
            },
          },
        },
      })),
    };
    const guard = new CustomerAuthGuard(httpService as any, { warn: jest.fn() } as any);
    const request: any = {
      header: jest.fn((name: string) => (name.toLowerCase() === 'authorization' ? 'Bearer customer-token' : undefined)),
    };
    const context: any = { switchToHttp: () => ({ getRequest: () => request }) };

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.customerAuth).toEqual({
      id: undefined,
      subject: 'auth-user-1',
      email: undefined,
      roles: ['app:marathon:user'],
    });
  });

  it('rejects requests without bearer tokens', async () => {
    process.env.AUTH_SERVICE_URL = 'http://auth-microservice:3370';
    const guard = new CustomerAuthGuard({ post: jest.fn() } as any, { warn: jest.fn() } as any);
    const context: any = {
      switchToHttp: () => ({ getRequest: () => ({ header: jest.fn(() => undefined) }) }),
    };

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
