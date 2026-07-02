import { validateDatabaseName } from '../src/database-bootstrap';

describe('database bootstrap', () => {
  it('accepts bounded database names', () => {
    expect(validateDatabaseName('invoices')).toBe('invoices');
    expect(validateDatabaseName('statex_invoices_2026')).toBe('statex_invoices_2026');
  });

  it('rejects unsafe database names', () => {
    expect(() => validateDatabaseName('invoices-prod')).toThrow(/DB_NAME/);
    expect(() => validateDatabaseName('invoices;drop database postgres')).toThrow(/DB_NAME/);
  });
});
