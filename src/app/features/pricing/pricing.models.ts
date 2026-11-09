export interface PricingRule { id?: string; customerUserId: string | null; customerName?: string; audience?: 'everyone' | 'user'; minimumQuantity: number | null; sellingPrice: string; active: boolean; }
export interface PricingVariant { key: string; values: Record<string, string>; }
export interface VariantPrice { variantKey: string; basis: 'fixed' | 'day' | 'hour' | 'minute' | 'second'; sellingPrice: string | null; purchaseCost: string | null; }
export interface PricedProduct { baseUnitName: string; baseUnitSymbol: string;
  id: string; name: string; type: string; categoryIds: string[]; purchaseCost: string | null; taxInclusive: boolean;
  separateTaxAmount: string | null; separateTaxId: string | null; defaultSellingPrice: string | null;
  rules: PricingRule[]; version: number; updatedAt: string | null;
  variations: PricingVariant[]; variantPrices: VariantPrice[];
}
export interface PricingCategory { id: string; name: string; parentId: string | null; }
export interface PricingCustomer { id: string; name: string; }
export interface PricingList { items: PricedProduct[]; categories: PricingCategory[]; customers: PricingCustomer[]; page: number; pageSize: number; total: number; hasNextPage: boolean; authorization: { isOwner: boolean; permissionKeys: string[] }; }
export interface PricingEnvelope<T> { success: boolean; data: T; }
export interface SimilarProduct { productId: string; name: string; score: number; }
export interface WorkbookProductChoice { rowNumber: number; key: string; productId: string | null; name: string; price?: string; similarMatches: SimilarProduct[]; }
export interface WorkbookValidation { operationId: string; digest: string; expiresAt: string; errors: Array<{ sheet: string; row: number; column: string; code?: string; message: string }>; products: WorkbookProductChoice[]; rules: WorkbookRuleChange[]; ruleCount: number; canCommit: boolean; }
export interface WorkbookDecision { rowNumber: number; action: 'create' | 'ignore' | 'update'; productId?: string; confirmDuplicate?: boolean; confirmed?: boolean; }
export interface WorkbookRuleChange { rowNumber: number; productName: string; customerName: string; minimumQuantity: number | null; sellingPrice: string; active: boolean; isNew: boolean; }
export interface WorkbookJobAccepted { jobId: string; status: string; }
export interface WorkbookJob<T = unknown> { jobId: string; status: 'queued' | 'processing' | 'completed' | 'failed'; progress: number; message: string; error?: string; result: T | null; resultUrl: string | null; downloadUrl: string | null; }
