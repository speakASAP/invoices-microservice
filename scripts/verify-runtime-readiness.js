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

assert(dbModule.includes('ensureDatabaseExistsFromEnv'), 'database module does not run DB bootstrap gate');
assert(dbBootstrap.includes("env.DB_AUTO_CREATE !== 'true'"), 'DB bootstrap is not opt-in');
assert(dbBootstrap.includes('validateDatabaseName'), 'DB bootstrap does not validate database identifiers');
assert(configMap.includes('DB_AUTO_CREATE: "false"'), 'production ConfigMap must keep DB auto-create disabled by default');
assert(configMap.includes('DB_ADMIN_DATABASE: "postgres"'), 'DB admin database config missing');
assert(configMap.includes('ORDERS_EVENTS_CONSUMER_ENABLED: "false"'), 'Orders event consumer must stay disabled until runtime blockers close');
assert(deployment.includes('secretRef:') && deployment.includes('invoices-microservice-secret'), 'deployment does not project invoices secret');
assert(externalSecret.includes('apiVersion: external-secrets.io/v1'), 'ExternalSecret apiVersion must match the live cluster CRD');
assert(consumer.includes("process.env.ORDERS_EVENTS_CONSUMER_ENABLED !== 'true'"), 'RabbitMQ consumer is not fail-closed by config');
assert(runtimePrereqs.includes('desired replicas > 0'), 'runtime prereq gate must reject scaled-to-zero dependencies');
assert(deployment.includes('invoices-microservice-seller-secret') && deployment.includes('optional: true'), 'seller legal secret must be optional for fail-closed deploys');
assert(!externalSecret.includes('INVOICE_SELLER_NAME'), 'runtime ExternalSecret must not require seller legal data for service startup');
assert(!runtimePrereqs.includes('INVOICE_SELLER_NAME'), 'runtime prereq gate must not require seller legal data for service startup');
assert(packageJson.includes('verify:final-smoke-prereqs'), 'final smoke prereq verifier script is not registered');
assert(packageJson.includes('verify:consumer-enable-prereqs'), 'consumer enable preflight script is not registered');
assert(packageJson.includes('runtime:enable-orders-consumer'), 'consumer enable runtime script is not registered');
assert(finalSmokePrereqs.includes('PAYMENT_API_KEY_SCOPES'), 'final smoke verifier must check Payments API key scope');
assert(finalSmokePrereqs.includes('channel_registry'), 'final smoke verifier must check Notifications channel policy');
assert(finalSmokePrereqs.includes('kubectl exec -i'), 'final smoke verifier must pipe Notifications channel SQL safely into Postgres');
assert(finalSmokePrereqs.includes('ALLOW_CONSUMER_DISABLED'), 'final smoke verifier must support consumer-disabled pre-enable checks');
assert(finalSmokePrereqs.includes('INVOICE_SELLER_NAME'), 'final smoke verifier must check seller legal data');
assert(finalSmokePrereqs.includes('ORDERS_EVENTS_CONSUMER_ENABLED'), 'final smoke verifier must check Orders consumer enablement');
assert(finalSmokePrereqs.includes('INVOICES_NOTIFICATIONS_SERVICE_TOKEN'), 'final smoke verifier must check Notifications token projection');
assert(dockerfile.includes('dist/src/main.js'), 'Docker image must start the built Nest entrypoint at dist/src/main.js');
assert(consumerEnableScript.includes('ALLOW_CONSUMER_DISABLED=true'), 'consumer enable script must prove prereqs before enabling the consumer');
assert(consumerEnableScript.includes('kubectl patch configmap') && consumerEnableScript.includes('ORDERS_EVENTS_CONSUMER_ENABLED'), 'consumer enable script must patch the consumer switch explicitly');
assert(consumerEnableScript.includes('kubectl rollout restart') && consumerEnableScript.includes('check-final-smoke-prereqs.sh'), 'consumer enable script must restart and re-run strict final-smoke prereqs');

console.log('Runtime readiness source verification passed');
