import type { ServiceRange } from '../documents/documents.models';

export interface PersonalBillRow {
  id: string; billNumber: string; billType: 'sale'; entryMode: 'detailed' | 'image'; status: 'issued' | 'cancelled';
  deliveryStatus: string; paymentStatus: string; billDate: string; dueDate: string; issuedAt: string | null;
  currencyCode: string; grandTotal: string; paidAmount: string; outstanding: string;
  partySnapshot: { name: string; phone: string; address: string };
  business: { id: string; name: string; phone: string; address: string; logoUrl: string };
  paidVia: string[];
}
export interface PersonalDashboard {
  user: { name: string; phone: string; photoUrl: string; status: string };
  counts: { myBills: number; paidByMe: number; iStillOwe: number; onTheWay: number };
  businesses: Array<{ id: string; name: string; phone: string; address: string; logoUrl: string; billCount: number; amount: string; amountKind: 'due' | 'extra'; currencyCode: string }>;
  items: PersonalBillRow[]; page: number; pageSize: number; total: number; hasNextPage: boolean;
}
export interface PersonalBill extends PersonalBillRow {
  gstin?: string;
  deliveredAtIssue: boolean; deliveryStartedAt: string | null; deliveredAt: string | null; cancelledAt: string | null;
  deliveryTimeline: Array<{ label: string; address: string; at: string | null }> | null;
  currencyScale: number; subtotal: string; afterDiscount: string | null; discountTotal: string; taxTotal: string;
  lines: Array<{ productName: string; productDescription: string; description: string; variantValues?: Record<string, string>; serviceRange?: ServiceRange | null; quantity: string | number; unitLabel: string; unitPrice: string; lineTotal: string }>;
  discounts: Array<{ name?: string; description?: string; amount?: string; value?: string; type?: string }>;
  taxes: Array<{ name?: string; amount?: string }>;
  imageAmounts: { taxableAmount: string; taxAmount: string; taxDescription: string } | null;
  files: Array<{ id: string; filename: string; contentType: string; size: number; url: string }>;
  allocations: Array<{ id: string; amount: string; payment: { id: string; number: string; date: string; method: string; details: Record<string, string> } }>;
}
export interface PersonalEnvelope<T> { success: boolean; data: T; }
