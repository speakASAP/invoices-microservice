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
const loggerService = read('src/common/logger.service.ts');
const k8sConfig = read('k8s/configmap.yaml');
const docs = read('docs/orchestrator/PLAN.md');
const storageContract = read('docs/orchestrator/INVOICE_DOCUMENT_STORAGE_CONTRACT.md');
const invoiceDocumentEntity = read('src/invoices/entities/invoice-document.entity.ts');
const invoiceMigration = read('src/migrations/20260702120000-CreateInvoicesTables.ts');

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
assert(invoiceDocumentEntity.includes('documentPdfSha256'), 'PDF checksum persistence missing');
assert(invoiceDocumentEntity.includes('documentObjectBucket'), 'invoice document object bucket reference missing');
assert(invoiceDocumentEntity.includes('documentObjectKey'), 'invoice document object key reference missing');
assert(invoiceDocumentEntity.includes('documentObjectSha256'), 'invoice document object checksum reference missing');
assert(invoiceDocumentEntity.includes('documentObjectEtag'), 'invoice document object etag reference missing');
assert(invoiceDocumentEntity.includes('documentObjectSize'), 'invoice document object size reference missing');
assert(invoiceDocumentEntity.includes('documentStoredAt'), 'invoice document stored-at reference missing');
assert(invoiceMigration.includes('documentObjectBucket') && invoiceMigration.includes('documentObjectKey'), 'invoice document object reference migration columns missing');
assert(invoiceMigration.includes('idx_invoice_documents_object_key'), 'invoice document object key index missing');
assert(loggerService.includes("serviceName = 'invoices-microservice'"), 'Logging payload must identify invoices service');
assert(loggerService.includes("loggingPath = process.env.LOGGING_SERVICE_API_PATH?.trim() || '/api/logs'"), 'Logging endpoint path must default to /api/logs');
assert(loggerService.includes("replace(/\\/+$/, '')"), 'Logging service URL must be normalized before posting logs');
assert(loggerService.includes('Bearer [redacted]') && loggerService.includes('[redacted-email]'), 'Logging payload must sanitize bearer tokens and emails');
assert(loggerService.includes('api[_-]?key'), 'Logging payload must redact API keys in metadata and messages');
assert(k8sConfig.includes('LOGGING_SERVICE_URL'), 'Kubernetes config must wire Logging service URL');
assert(customerGuard.includes('/auth/validate'), 'customer account access must validate tokens through Auth');
assert(service.includes("#>> \\'{customer,email}\\'"), 'customer account invoice access must scope by stored customer email');
assert(service.includes("#>> \\'{customer,authUserId}\\'") && service.includes("#>> \\'{authUserId}\\'"), 'customer account invoice access must support stored Auth subject identity');
assert(service.includes('findByCustomerIdentity'), 'customer account invoice access must use subject/email identity matching');
assert(service.includes('uq_invoice_documents_order_type') || read('src/migrations/20260702120000-CreateInvoicesTables.ts').includes('uq_invoice_documents_order_type'), 'order/type uniqueness missing');
assert(docs.includes('Orders events remain trigger-only'), 'trigger-only Orders event plan missing');
assert(docs.includes('subject/email account-scoped invoice listing'), 'account access plan missing');
assert(storageContract.includes('MinIO/S3-backed immutable PDF object storage'), 'invoice document storage contract must select MinIO/S3 immutable PDF storage');
assert(storageContract.includes('[MISSING: invoice document bucket name]'), 'invoice document storage contract must keep bucket provisioning explicit');
assert(storageContract.includes('invoices/{yyyy}/{orderId}/{type}/{invoiceId}-{documentPdfSha256}.pdf'), 'invoice document storage contract must define deterministic key layout');
assert(storageContract.includes('documentObjectBucket') && storageContract.includes('documentObjectKey'), 'invoice document storage contract must document object reference fields');
assert(storageContract.includes('source-implemented') && storageContract.includes('runtime-not-applied'), 'invoice document storage contract must distinguish source schema from runtime application');
assert(storageContract.includes('documentPdfSha256'), 'invoice document storage contract must require PDF checksum metadata');
assert(storageContract.includes('application/pdf'), 'invoice document storage contract must require PDF MIME type');
assert(storageContract.includes('tokenized endpoints') && storageContract.includes('Presigned URLs'), 'invoice document storage contract must define tokenized or presigned access');
assert(storageContract.includes('Logs must not include raw PDF bytes'), 'invoice document storage contract must forbid raw PDF logs');
assert(storageContract.includes('Direct email attachments are explicitly deferred'), 'invoice document storage contract must defer direct Notifications attachments');
assert(storageContract.includes('Do not add S3 runtime dependencies'), 'invoice document storage contract must keep runtime storage implementation gated');

console.log('Invoice contract verification passed');
