export type DocumentKind = 'orders' | 'leads';
export type OrderType = 'sales' | 'purchase';
export type EntryMode = 'detailed' | 'image_only';

export interface ProductOption {
  id: string; name: string; code: string; description: string; baseUnitId: string | null;
  additionalUnits: Array<{ unitId: string; conversionFactor: number }>;
  price: null | { defaultSellingPrice: string | null; purchaseCost: string | null; version: number; rules: Array<{ id: string; customerUserId: string | null; minimumQuantity: number | null; sellingPrice: string; active: boolean }> };
}
export interface UnitOption { id: string; name: string; symbol: string; }
export interface TaxOption { id: string; name: string; calculationType: 'fixed' | 'percentage'; value: number; description: string; currency?: string; jurisdiction?: string; effectiveStart?: string; effectiveEnd?: string | null; revision?: string; }
export interface DocumentOptions { products: ProductOption[]; units: UnitOption[]; taxes: TaxOption[]; }
export interface DocumentLine {
  productId: string; productName?: string; productCode?: string; productDescription?: string;
  quantity: string; unitId: string; unitLabel?: string; unitPrice: string; priceOrigin: 'master' | 'manual';
  manualOverride?: boolean; sourcePrice?: string | null; sourcePriceRevision?: string | null;
  discount?: { type: 'fixed' | 'percentage'; value: string } | null; lineTotal?: string; conversionFactor?: string;
}
export interface BusinessDocument {
  id: string; businessId: string; orderNumber?: string; leadNumber?: string; orderType?: OrderType;
  entryMode?: EntryMode; status: string; version: number; documentDate: string; createdAtClient: string; currencyCode?: string | null; currencyScale?: number | null;
  contactUserId?: string | null; contactSnapshot?: { name: string; phone?: string; address?: string } | null;
  lines: DocumentLine[]; discounts: Array<{ type: 'fixed' | 'percentage'; value: string }>;
  taxes: Array<{ taxId: string; name: string; calculationType: 'fixed' | 'percentage'; value: string; currency?: string; jurisdiction?: string; description?: string; revision?: string; effectiveStart?: string; effectiveEnd?: string | null; amount?: string; basis?: string }>; taxSelectionSet?: boolean;
  subtotal?: string | null; discountTotal?: string | null; afterDiscount?: string | null; taxTotal?: string | null; grandTotal?: string | null;
  imageAmounts?: { taxableAmount: string; taxAmount: string; taxDescription?: string } | null;
  imageIds?: string[]; imageMetadata?: Array<{ _id?: string; id?: string; filename: string; contentType: string; size: number; width: number; height: number }>;
  convertedOrderId?: string | null; conversionMode?: 'order' | 'bill' | null; orderStatus?: string | null; billStatus?: 'draft' | 'confirmed' | 'delivered' | 'cancelled' | null; billGeneratedAt?: string | null; deliveryCompleted?: boolean;
  billSummaries?: Array<{ id: string; number: string; deliveryStatus: string; paymentStatus: string; outstanding: string; total: string }>;
}
export interface DocumentPage<T> { items: T[]; page: number; pageSize: number; total: number; hasNextPage: boolean; authorization: { isOwner: boolean; permissionKeys: string[] }; }
export interface ApiEnvelope<T> { success: boolean; data: T; }
