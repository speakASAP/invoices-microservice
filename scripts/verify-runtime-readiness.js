const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const dbModule = read('src/database.module.ts');
const dbBootstrap = read('src/database-bootstrap.ts');
const configMap = read('k8s/configmap.yaml');
const deployment = read('k8s/deployment.yaml');
const externalSecret = read('k8s/external-secret.yaml');
const dockerfile = read('Dockerfile');
const consumer = read('src/events/rabbitmq-orders.consumer.ts');
const runtimePrereqs = read('scripts/check-runtime-prereqs.sh');
const finalSmokePrereqs = read('scripts/check-final-smoke-prereqs.sh');
const packageJson = read('package.json');
const consumerEnableScript = read('scripts/enable-orders-consumer-for-final-smoke.sh');
const sellerSyncScript = read('scripts/sync-seller-legal-secret.sh');
const sellerExternalSecret = read('k8s/seller-external-secret.yaml');
const finalSmokeEvidenceScript = read('scripts/check-final-smoke-evidence.sh');
const finalSmokeFixtureScript = read('scripts/run-final-smoke-fixture.sh');

assert(dbModule.includes('ensureDatabaseExistsFromEnv'), 'database module does not run DB bootstrap gate');
assert(dbBootstrap.includes("env.DB_AUTO_CREATE !== 'true'"), 'DB bootstrap is not opt-in');
assert(dbBootstrap.includes('validateDatabaseName'), 'DB bootstrap does not validate database identifiers');
assert(configMap.includes('DB_AUTO_CREATE: "false"'), 'production ConfigMap must keep DB auto-create disabled by default');
assert(configMap.includes('DB_ADMIN_DATABASE: "postgres"'), 'DB admin database config missing');
assert(configMap.includes("RABBITMQ_URL: \"amqp://guest:guest@rabbitmq.statex-apps.svc.cluster.local:5672\""), "production ConfigMap must use the in-cluster RabbitMQ service");
assert(!configMap.includes("host.k3s.internal"), "production ConfigMap must not use host.k3s.internal for RabbitMQ inside Kubernetes");
assert(configMap.includes('ORDERS_EVENTS_CONSUMER_ENABLED: "false"'), 'Orders event consumer must stay disabled until runtime blockers close');
assert(deployment.includes('secretRef:') && deployment.includes('invoices-microservice-secret'), 'deployment does not project invoices secret');
assert(externalSecret.includes('apiVersion: external-secrets.io/v1'), 'ExternalSecret apiVersion must match the live cluster CRD');
assert(consumer.includes("process.env.ORDERS_EVENTS_CONSUMER_ENABLED !== 'true'"), 'RabbitMQ consumer is not fail-closed by config');
assert(runtimePrereqs.includes('desired replicas > 0'), 'runtime prereq gate must reject scaled-to-zero dependencies');
assert(deployment.includes('invoices-microservice-seller-secret') && deployment.includes('optional: true'), 'seller legal secret must be optional for fail-closed deploys');
assert(!externalSecret.includes('INVOICE_SELLER_NAME'), 'runtime ExternalSecret must not require seller legal data for service startup');
assert(!runtimePrereqs.includes('INVOICE_SELLER_NAME'), 'runtime prereq gate must not require seller legal data for service startup');
assert(packageJson.includes('verify:final-smoke-prereqs'), 'final smoke prereq verifier script is not registered');
assert(packageJson.includes('verify:final-smoke-evidence'), 'final smoke evidence verifier script is not registered');
assert(packageJson.includes('runtime:run-final-smoke-fixture'), 'final smoke fixture runtime script is not registered');
assert(packageJson.includes('verify:consumer-enable-prereqs'), 'consumer enable preflight script is not registered');
assert(packageJson.includes('verify:seller-legal-source'), 'seller legal source verifier script is not registered');
assert(packageJson.includes('runtime:sync-seller-legal'), 'seller legal sync runtime script is not registered');
assert(packageJson.includes('runtime:enable-orders-consumer'), 'consumer enable runtime script is not registered');
assert(finalSmokePrereqs.includes('PAYMENT_API_KEY_SCOPES'), 'final smoke verifier must check Payments API key scope');
assert(finalSmokePrereqs.includes('channel_registry'), 'final smoke verifier must check Notifications channel policy');
assert(finalSmokePrereqs.includes('kubectl exec -i'), 'final smoke verifier must pipe Notifications channel SQL safely into Postgres');
assert(finalSmokePrereqs.includes('ALLOW_CONSUMER_DISABLED'), 'final smoke verifier must support consumer-disabled pre-enable checks');
assert(finalSmokePrereqs.includes('INVOICE_SELLER_NAME'), 'final smoke verifier must check seller legal data');
assert(finalSmokePrereqs.includes('ORDERS_EVENTS_CONSUMER_ENABLED'), 'final smoke verifier must check Orders consumer enablement');
assert(finalSmokePrereqs.includes("RABBITMQ_URL uses cluster-reachable broker"), "final smoke verifier must reject non-cluster RabbitMQ URLs");
assert(finalSmokePrereqs.includes("INVOICES_ORDERS_QUEUE is configured"), "final smoke verifier must check the invoices orders queue name");
assert(finalSmokePrereqs.includes('INVOICES_NOTIFICATIONS_SERVICE_TOKEN'), 'final smoke verifier must check Notifications token projection');
assert(finalSmokeFixtureScript.includes('FINAL_SMOKE_APPROVED') && finalSmokeFixtureScript.includes('customerContact') && finalSmokeFixtureScript.includes('providerCall'), 'final smoke fixture must be approval-gated and record no provider/customer-contact intent');
assert(finalSmokeFixtureScript.includes('orders.order.created.v1') && finalSmokeFixtureScript.includes('orders.order.paid.v1'), 'final smoke fixture must publish the created and paid order lifecycle triggers');
assert(finalSmokeFixtureScript.includes('PAYMENT_APPLICATION_ID') && finalSmokeFixtureScript.includes('PAYMENT_ID'), 'final smoke fixture must print the payment evidence identifiers');
assert(finalSmokeFixtureScript.includes('cleanup_fixture'), 'final smoke fixture must clean up partial rows on failure');
assert(finalSmokeEvidenceScript.includes('ORDER_ID'), 'final smoke evidence verifier must require ORDER_ID');
assert(finalSmokeEvidenceScript.includes('SKIP_FINAL_SMOKE_PREREQS'), 'final smoke evidence verifier must run strict prereqs by default with an explicit skip escape hatch');
assert(finalSmokeEvidenceScript.includes('invoice_documents') && finalSmokeEvidenceScript.includes('invoice_event_records'), 'final smoke evidence verifier must inspect invoice DB evidence');
assert(finalSmokeEvidenceScript.includes('paymentSnapshot') && finalSmokeEvidenceScript.includes('providerCall'), 'final smoke evidence verifier must inspect payment snapshot evidence');
assert(finalSmokeEvidenceScript.includes('payments/status/by-order-id') && finalSmokeEvidenceScript.includes('mutation=false'), 'final smoke evidence verifier must inspect Payments read-only snapshot API');
assert(finalSmokeEvidenceScript.includes('document.pdf') && finalSmokeEvidenceScript.includes('%PDF'), 'final smoke evidence verifier must fetch internal PDF documents');
assert(finalSmokeEvidenceScript.includes('CUSTOMER_BEARER_TOKEN'), 'final smoke evidence verifier must support optional customer account evidence');
assert(finalSmokeEvidenceScript.includes('LOGGING_ADMIN_BEARER_TOKEN'), 'final smoke evidence verifier must support optional Logging evidence');
assert(finalSmokeEvidenceScript.includes('VERIFY_DOWNLOAD_LINK_ROTATION') && finalSmokeEvidenceScript.includes('FINAL_SMOKE_APPROVED'), 'final smoke evidence verifier must guard token-rotation mutations');
assert(dockerfile.includes('dist/src/main.js'), 'Docker image must start the built Nest entrypoint at dist/src/main.js');
assert(consumerEnableScript.includes('ALLOW_CONSUMER_DISABLED=true'), 'consumer enable script must prove prereqs before enabling the consumer');
assert(consumerEnableScript.includes('kubectl patch configmap') && consumerEnableScript.includes('ORDERS_EVENTS_CONSUMER_ENABLED'), 'consumer enable script must patch the consumer switch explicitly');
assert(consumerEnableScript.includes('kubectl rollout restart') && consumerEnableScript.includes('check-final-smoke-prereqs.sh'), 'consumer enable script must restart and re-run strict final-smoke prereqs');
assert(sellerSyncScript.includes('SELLER_VAULT_SECRET_PATH') && sellerSyncScript.includes('secret/prod/invoices-microservice-seller'), 'seller legal sync must use the dedicated invoices seller Vault path');
assert(sellerSyncScript.includes('VERIFY_ONLY') && sellerSyncScript.includes('ALLOW_CONSUMER_DISABLED=true'), 'seller legal sync must support verify-only and pre-consumer final-smoke checks');
assert(sellerSyncScript.includes('INVOICE_SELLER_NAME') && sellerSyncScript.includes('INVOICE_SELLER_ADDRESS'), 'seller legal sync must require seller name and address');
assert(sellerSyncScript.includes('INVOICE_SELLER_COMPANY_ID') && sellerSyncScript.includes('INVOICE_SELLER_TAX_ID') && sellerSyncScript.includes('INVOICE_SELLER_VAT_ID'), 'seller legal sync must require at least one tax/company identifier path');
assert(sellerExternalSecret.includes('secret/prod/invoices-microservice-seller'), 'seller ExternalSecret must point at the dedicated seller legal Vault path');
assert(sellerExternalSecret.includes('invoices-microservice-seller-secret'), 'seller ExternalSecret must produce the seller legal Kubernetes secret');

console.log('Runtime readiness source verification passed');
