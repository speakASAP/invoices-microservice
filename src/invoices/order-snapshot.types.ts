export interface InvoiceOrderItemSnapshot {
  productId?: string;
  sku?: string;
  productName?: string;
  quantity: number;
  unitPrice?: number | string;
  totalPrice?: number | string;
}

export interface InvoiceAddressSnapshot {
  name?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  companyName?: string;
  taxId?: string;
  vatId?: string;
}

export interface InvoiceCustomerSnapshot {
  name?: string;
  email?: string;
  phone?: string;
}

export interface InvoiceOrderSnapshot {
  id: string;
  channel?: string;
  status?: string;
  currency?: string;
  subtotal?: number | string;
  shippingCost?: number | string;
  taxAmount?: number | string;
  total?: number | string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentReferenceId?: string;
  paymentApplicationId?: string;
  paymentUpdatedAt?: string;
  customer?: InvoiceCustomerSnapshot | null;
  billingAddress?: InvoiceAddressSnapshot | null;
  shippingAddress?: InvoiceAddressSnapshot | null;
  items?: InvoiceOrderItemSnapshot[];
  orderedAt?: string;
  createdAt?: string;
}

export interface SellerSnapshot {
  name: string;
  address: string;
  companyId?: string;
  taxId?: string;
  vatId?: string;
  email?: string;
}
