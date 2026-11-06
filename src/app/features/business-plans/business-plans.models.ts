export interface BillUsage { used: number; pending: number; total: number; }
export interface ActiveBusinessPlan { id: string; name: string; monthlyPrice: number; includedBills: number; status: string; effectiveMonth: string; }
export interface BusinessExtraCredit { id: string; packId: string; name: string; code: string; price: number; status: 'delivered' | 'carriedForward'; used: number; pending: number; total: number; purchasedAt: string; }
export interface FeaturedBusinessOffer { offerName: string; code: string; planId: string; planName: string; includedBills: number; monthlyPrice: number; discountAmount: number; amountDue: number; }
export interface BusinessPlansDashboard { businessId: string; businessName: string; businessTypeName: string; month: string; activePlan: ActiveBusinessPlan; activePlanUsage: BillUsage; monthUsage: BillUsage; exhausted: boolean; extraCredits: BusinessExtraCredit[]; featuredOffers: FeaturedBusinessOffer[]; authorization: { isOwner: boolean; permissionKeys: string[] }; }
export interface AvailablePlan { id: string; name: string; monthlyPrice: number; includedBills: number; }
export interface AvailableExtraCredit { id: string; code: string; name: string; price: number; billCount: number; }
export interface ValidatedOffer { eligible: boolean; offer: null | { name: string; code: string; discountType: 'percent' | 'flat'; amount: number; discountAmount: number; amountDue: number }; discountAmount: number; amountDue: number; plan: AvailablePlan; }
export interface BusinessPlansEnvelope<T> { success: boolean; data: T; }
