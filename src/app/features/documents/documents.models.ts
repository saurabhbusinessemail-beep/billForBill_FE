import type { PricingVariant, VariantPrice } from '../pricing/pricing.models';

export type DocumentKind = 'orders' | 'leads';
export type OrderType = 'sales' | 'purchase';
export type EntryMode = 'detailed' | 'image_only';

export type ServiceMode = 'date_time' | 'dates' | 'times' | 'one_date' | 'one_date_time' | 'none';
export interface ServiceRange {
  mode: ServiceMode;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  durationSeconds?: number;
}

interface DocumentUnit { key: string; name: string; symbol: string; factorToBase: string; active: boolean; }

export interface ProductOption {
  id: string; name: string; code: string; description: string;
  serviceMeasurement?: ServiceMode | null;
  legacyVariantKey: string;
  matchedVariantKey?: string;
  variations: Array<PricingVariant & { baseUnit: DocumentUnit | null; additionalUnits: DocumentUnit[]; unitConfigRevision: string }>;
  price: null | { defaultSellingPrice: string | null; purchaseCost: string | null; version: number; variantPrices: VariantPrice[]; rules: Array<{ id: string; customerUserId: string | null; minimumQuantity: number | null; sellingPrice: string; active: boolean }> };
}
export interface UnitOption { id: string; name: string; symbol: string; }
export interface TaxOption { id: string; name: string; calculationType: 'fixed' | 'percentage'; value: number; description: string; currency?: string; jurisdiction?: string; effectiveStart?: string; effectiveEnd?: string | null; revision?: string; }
export interface DocumentOptions { products: ProductOption[]; taxes: TaxOption[]; currencyCode?: string; timeZone?: string; }
export interface DocumentLine {
  variantKey?: string;
  variantValues?: Record<string, string>;
  serviceRange?: ServiceRange | null;
  rateBasis?: VariantPrice['basis'];
  manualQuantity?: boolean;
  productId: string; productName?: string; productCode?: string; productDescription?: string;
  quantity: string; unitKey: string; unitId?: string; factorToBase?: string; unitSymbol?: string; lineId?: string; unitConfigRevision?: string; unitLabel?: string; unitPrice: string; priceOrigin: 'master' | 'manual';
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
