import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs';
import { apiBaseUrl } from '../../app-config';
import { AvailableExtraCredit, AvailablePlan, BusinessPlansDashboard, BusinessPlansEnvelope, ValidatedOffer } from './business-plans.models';

const base = `${apiBaseUrl()}/businesses`;
@Injectable({ providedIn: 'root' })
export class BusinessPlansApiService {
  constructor(private readonly http: HttpClient) {}
  private url(id: string): string { return `${base}/${encodeURIComponent(id)}/plans`; }
  dashboard(id: string) { return this.http.get<BusinessPlansEnvelope<BusinessPlansDashboard>>(this.url(id), { withCredentials: true }).pipe(map(response => response.data)); }
  availablePlans(id: string) { return this.http.get<BusinessPlansEnvelope<AvailablePlan[]>>(`${this.url(id)}/available`, { withCredentials: true }).pipe(map(response => response.data)); }
  availableExtraCredits(id: string) { return this.http.get<BusinessPlansEnvelope<AvailableExtraCredit[]>>(`${this.url(id)}/extra-credits/available`, { withCredentials: true }).pipe(map(response => response.data)); }
  validateOffer(id: string, planId: string, code: string) { return this.http.post<BusinessPlansEnvelope<ValidatedOffer>>(`${this.url(id)}/offers/validate`, { planId, code }, { withCredentials: true }).pipe(map(response => response.data)); }
  purchasePlan(id: string, planId: string, offerCode: string, idempotencyKey: string) { return this.http.post<BusinessPlansEnvelope<unknown>>(`${this.url(id)}/purchases`, { planId, ...(offerCode ? { offerCode } : {}) }, { withCredentials: true, headers: { 'Idempotency-Key': idempotencyKey } }).pipe(map(response => response.data)); }
  purchaseExtraCredit(id: string, extraCreditPackId: string, idempotencyKey: string) { return this.http.post<BusinessPlansEnvelope<unknown>>(`${this.url(id)}/extra-credit-purchases`, { extraCreditPackId }, { withCredentials: true, headers: { 'Idempotency-Key': idempotencyKey } }).pipe(map(response => response.data)); }
}
