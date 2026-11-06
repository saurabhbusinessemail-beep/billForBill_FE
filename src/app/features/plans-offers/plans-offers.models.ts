export type PlansOffersTab = 'plans' | 'credits' | 'offers';
export interface PlansOffersPage<T> { items: T[]; page: number; limit: number; total: number; totalPages: number; }
export interface PlanRecord { id: string; name: string; monthlyPrice: number; includedBills: number; offerCount: number; isActive: boolean; createdAt: string; }
export interface CreditPackRecord { id: string; code: string; name: string; price: number; billCount: number; isActive: boolean; createdAt: string; }
export interface OfferRecord { id: string; name: string; code: string; discountType: 'percent' | 'flat'; amount: number | null; planIds: string[]; userIds: string[]; businessIds: string[]; businessTypeIds: string[]; planNames?: string[]; userNames?: string[]; businessNames?: string[]; businessTypeNames?: string[]; validTill: string | null; isActive: boolean; createdAt: string; }
export interface TargetOption { id: string; name: string; phone?: string; ownerPhone?: string; }
export interface PlansOffersResponse<T> { success: boolean; data: T; }
