export const ORDERS_EVENT_SOURCE = 'orders-microservice';
export const ORDERS_EVENT_VERSION = 1;

export const ORDERS_EVENT_TYPES = {
  created: 'orders.order.created.v1',
  paid: 'orders.order.paid.v1',
} as const;

export type SupportedOrdersEventType = typeof ORDERS_EVENT_TYPES[keyof typeof ORDERS_EVENT_TYPES];

export interface OrdersEventEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  type: SupportedOrdersEventType;
  eventVersion: 1;
  eventId: string;
  occurredAt: string;
  source: typeof ORDERS_EVENT_SOURCE;
  payload: TPayload;
}

export interface OrderCreatedEventPayload extends Record<string, unknown> {
  orderId: string;
  channel: string;
  currency?: string;
  items?: Array<{
    productId: string;
    sku?: string;
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
  }>;
}

export interface OrderPaidEventPayload extends Record<string, unknown> {
  orderId: string;
  paymentStatus: 'paid';
  paymentReferenceId?: string;
}

export type VerifiedOrdersEvent =
  | OrdersEventEnvelope<OrderCreatedEventPayload>
  | OrdersEventEnvelope<OrderPaidEventPayload>;

export type OrdersEventValidationResult =
  | { valid: true; event: VerifiedOrdersEvent }
  | { valid: false; reason: string };

const VALID_TYPES = new Set<string>(Object.values(ORDERS_EVENT_TYPES));
const FORBIDDEN_KEYS = new Set([
  'customer',
  'customeremail',
  'customerphone',
  'email',
  'phone',
  'address',
  'billingaddress',
  'shippingaddress',
  'street',
  'postalcode',
  'paymentmethod',
  'card',
  'pan',
  'cvv',
  'iban',
  'token',
  'authorization',
  'bearer',
  'jwt',
  'secret',
  'password',
  'credential',
  'providertransactionid',
  'providerresponse',
]);

export function validateOrdersEventEnvelope(input: unknown): OrdersEventValidationResult {
  if (!isRecord(input)) return { valid: false, reason: 'event_not_object' };
  if (!isNonEmptyString(input.type) || !VALID_TYPES.has(input.type)) return { valid: false, reason: 'unsupported_event_type' };
  if (input.eventVersion !== ORDERS_EVENT_VERSION) return { valid: false, reason: 'unsupported_event_version' };
  if (!isNonEmptyString(input.eventId)) return { valid: false, reason: 'missing_event_id' };
  if (!isNonEmptyString(input.occurredAt) || Number.isNaN(Date.parse(input.occurredAt))) return { valid: false, reason: 'invalid_occurred_at' };
  if (input.source !== ORDERS_EVENT_SOURCE) return { valid: false, reason: 'unsupported_event_source' };
  if (!isRecord(input.payload)) return { valid: false, reason: 'payload_not_object' };
  if (hasForbiddenPayloadKey(input.payload)) return { valid: false, reason: 'payload_contains_forbidden_fields' };

  const payload = input.payload;
  if (!isNonEmptyString(payload.orderId)) return { valid: false, reason: 'missing_order_id' };

  if (input.type === ORDERS_EVENT_TYPES.created) {
    if (!isNonEmptyString(payload.channel)) return { valid: false, reason: 'missing_channel' };
    return { valid: true, event: input as unknown as OrdersEventEnvelope<OrderCreatedEventPayload> };
  }

  if (input.type === ORDERS_EVENT_TYPES.paid) {
    if (payload.paymentStatus !== 'paid') return { valid: false, reason: 'invalid_payment_status' };
    return { valid: true, event: input as unknown as OrdersEventEnvelope<OrderPaidEventPayload> };
  }

  return { valid: false, reason: 'unsupported_event_type' };
}

function hasForbiddenPayloadKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((entry) => hasForbiddenPayloadKey(entry));
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, child]) => FORBIDDEN_KEYS.has(key.toLowerCase()) || hasForbiddenPayloadKey(child));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
