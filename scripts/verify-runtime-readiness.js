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
const consumer = read('src/events/rabbitmq-orders.consumer.ts');
const runtimePrereqs = read('scripts/check-runtime-prereqs.sh');

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

console.log('Runtime readiness source verification passed');
