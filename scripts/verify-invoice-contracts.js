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
const service = read('src/invoices/invoices.service.ts');
const controller = read('src/invoices/invoices.controller.ts');
const docs = read('docs/orchestrator/PLAN.md');

assert(eventDto.includes("created: 'orders.order.created.v1'"), 'created Orders event contract missing');
assert(eventDto.includes("paid: 'orders.order.paid.v1'"), 'paid Orders event contract missing');
assert(eventDto.includes('payload_contains_forbidden_fields'), 'forbidden payload guard missing');
assert(service.includes('order_snapshot_unavailable'), 'blocked order snapshot behavior missing');
assert(service.includes('seller_legal_config_missing'), 'seller legal fail-closed behavior missing');
assert(service.includes('createDownloadLink'), 'download link rotation support missing');
assert(controller.includes("Post('invoices/:invoiceId/download-link')"), 'internal download-link endpoint missing');
assert(controller.includes("Get('invoices/:invoiceId/document.html')"), 'internal document read endpoint missing');
assert(service.includes('uq_invoice_documents_order_type') || read('src/migrations/20260702120000-CreateInvoicesTables.ts').includes('uq_invoice_documents_order_type'), 'order/type uniqueness missing');
assert(docs.includes('Orders events remain trigger-only'), 'trigger-only Orders event plan missing');

console.log('Invoice contract verification passed');
