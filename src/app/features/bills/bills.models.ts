export interface Bill {
  id: string; version?: number; billType: 'sale' | 'purchase'; entryMode: 'detailed' | 'image'; status: 'draft' | 'issued' | 'cancelled'; deliveryStatus: string;
  billNumber: string | null; billDate: string; dueDate: string; partyUserId: string | null; partySnapshot: { name?: string; phone?: string; address?: string; type?: string }; orderNumber?: string; deliveredAtIssue?: boolean;
  orderId: string | null; leadId: string | null; grandTotal: string; currencyCode?: string; paidAmount?: string; outstanding?: string; paymentStatus?: string;
  lines?: BillLineRecord[]; imageAmounts?: { taxableAmount: string; taxAmount: string; taxDescription: string };
  subtotal?: string; afterDiscount?: string; taxes?: Array<{ name?: string; amount?: string }>;
  files?: Array<{ id: string; filename: string; contentType: string; size: number; url: string }>;
  allocations?: Array<{ id: string; amount: string; reversedAt?: string | null; payment?: { id: string; paymentNumber: string; date: string; method: string } | null }>;
}
export interface Payment { id: string; paymentNumber: string; direction: 'incoming' | 'outgoing'; partySnapshot: { name?: string; phone?: string }; amount: string; allocatedAmount: string; advanceAmount: string; currencyCode: string; paymentDate: string; method: string; methodDetails?: Record<string,string>; settledBills?: string[]; status: string; }
export interface PartyBalance { id: string; name: string; phone: string; type: string; billed: string; paid: string; outstanding: string; openBills: number; overdue: boolean; direction: 'incoming' | 'outgoing'; currencyCode: string; }
export interface BillLineRecord { id?: string; productDescription?: string; productName?: string; description?: string; quantity?: string | number; unitLabel?: string; unitPrice?: string; lineTotal?: string; }
export interface PaymentRecord extends Payment {
  partyUserId?: string | null; methodDetails?: Record<string, string>; note?: string; reversalReason?: string; reversedAt?: string | null;
  allocations: Array<{ id: string; kind: string; amount: string; reversedAt?: string | null; bill: { id: string; billNumber: string | null; billDate: string; grandTotal: string; currencyCode: string } | null }>;
  journals: Array<{ id: string; event: string; currencyCode: string; amount: string; createdAt: string; entries: Array<{ account: string; debit: string; credit: string }> }>;
}
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number; hasNextPage: boolean; authorization: { isOwner: boolean; permissionKeys: string[] }; }
export interface BillsSummary { billCount: number; salesCount: number; purchaseCount: number; receivable: string; payable: string; inTransit: number; currencyCode: string; }
export interface PaymentsSummary { received: string; paid: string; incomingAdvance: string; receivable: string; payable: string; currencyCode: string; paymentCount: number; }
export interface BillEnvelope<T> { success: boolean; data: T; }
