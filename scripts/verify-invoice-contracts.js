const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const eventDto = read('src/invoices/orders-event.dto.ts');
const customerGuard = read('src/common/customer-auth.guard.ts');
const service = read('src/invoices/invoices.service.ts');
const controller = read('src/invoices/invoices.controller.ts');
const docs = read('docs/orchestrator/PLAN.md');

assert(eventDto.includes("created: 'orders.order.created.v1'"), 'created Orders event contract missing');
assert(eventDto.includes("paid: 'orders.order.paid.v1'"), 'paid Orders event contract missing');
assert(eventDto.includes('payload_contains_forbidden_fields'), 'forbidden payload guard missing');
assert(service.includes('order_snapshot_unavailable'), 'blocked order snapshot behavior missing');
assert(service.includes('seller_legal_config_missing'), 'seller legal fail-closed behavior missing');
assert(service.includes('createDownloadLink'), 'download link rotation support missing');
assert(service.includes('getDocumentPdf'), 'PDF document read support missing');
assert(controller.includes("Post('invoices/:invoiceId/download-link')"), 'internal download-link endpoint missing');
assert(controller.includes("Get('invoices/account')"), 'customer account invoice listing endpoint missing');
assert(controller.includes("Post('invoices/account/:invoiceId/download-link')"), 'customer account download-link endpoint missing');
assert(controller.includes("Get('invoices/:invoiceId/document.html')"), 'internal document read endpoint missing');
assert(controller.includes("Get('invoices/:invoiceId/document.pdf')"), 'internal PDF document read endpoint missing');
assert(controller.includes("Get('documents/:invoiceId.pdf')"), 'public PDF document endpoint missing');
assert(read('src/invoices/entities/invoice-document.entity.ts').includes('documentPdfSha256'), 'PDF checksum persistence missing');
assert(customerGuard.includes('/auth/validate'), 'customer account access must validate tokens through Auth');
assert(service.includes("#>> \\'{customer,email}\\'"), 'customer account invoice access must scope by stored customer email');
assert(service.includes("#>> \\'{customer,authUserId}\\'") && service.includes("#>> \\'{authUserId}\\'"), 'customer account invoice access must support stored Auth subject identity');
assert(service.includes('findByCustomerIdentity'), 'customer account invoice access must use subject/email identity matching');
assert(service.includes('uq_invoice_documents_order_type') || read('src/migrations/20260702120000-CreateInvoicesTables.ts').includes('uq_invoice_documents_order_type'), 'order/type uniqueness missing');
assert(docs.includes('Orders events remain trigger-only'), 'trigger-only Orders event plan missing');
assert(docs.includes('subject/email account-scoped invoice listing'), 'account access plan missing');

console.log('Invoice contract verification passed');
