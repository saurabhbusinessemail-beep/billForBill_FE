import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { PricedProduct, PricingEnvelope, PricingList, WorkbookDecision, WorkbookValidation, WorkbookJob, WorkbookJobAccepted } from './pricing.models';
const local = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const host = window.location.hostname === '::1' ? '[::1]' : window.location.hostname;
const API = local ? `https://${host}:3000/businesses` : `${window.location.origin}/businesses`;
@Injectable({ providedIn: 'root' })
export class PricingApiService {
  constructor(private readonly http: HttpClient) {}
  list(businessId: string, search = '', categoryId = '', page = 1): Observable<PricingList> {
    let params = new HttpParams().set('page', page); if (search.trim()) params = params.set('search', search.trim()); if (categoryId) params = params.set('categoryId', categoryId);
    return this.http.get<PricingEnvelope<PricingList>>(`${API}/${encodeURIComponent(businessId)}/pricing`, { params, withCredentials: true }).pipe(map(x => x.data));
  }
  save(businessId: string, productId: string, changes: Partial<PricedProduct>): Observable<PricedProduct> {
    return this.http.put<PricingEnvelope<PricedProduct>>(`${API}/${encodeURIComponent(businessId)}/pricing/products/${encodeURIComponent(productId)}`, changes, { withCredentials: true }).pipe(map(x => x.data));
  }
  bulk(businessId: string, productIds: string[], changes: Partial<PricedProduct>, preview = false) {
    return this.http.post<PricingEnvelope<{ items: Array<{ productId: string; name?: string; oldValue?: string | null; newValue?: string; success?: boolean; code?: string }>; succeeded?: number; failed?: number }>>(`${API}/${encodeURIComponent(businessId)}/pricing/bulk`, { ...changes, productIds, preview }, { withCredentials: true }).pipe(map(x => x.data));
  }
  exportWorkbook(businessId: string, type: 'selling' | 'purchase', productIds: string[]) {
    return this.http.post<PricingEnvelope<WorkbookJobAccepted>>(`${API}/${encodeURIComponent(businessId)}/pricing/workbooks/${type}/export`, { productIds }, { withCredentials: true }).pipe(map(x => x.data));
  }
  lookupCustomer(businessId: string, phone: { countryCallingCode: string; phoneNumber: string }) {
    const params = new HttpParams().set('countryCallingCode', phone.countryCallingCode).set('phoneNumber', phone.phoneNumber);
    return this.http.get<PricingEnvelope<{exists:boolean;userId?:string;name?:string}>>(`${API}/${encodeURIComponent(businessId)}/pricing/customers/lookup`, { params, withCredentials:true }).pipe(map(x=>x.data));
  }
  validateWorkbook(businessId: string, type: 'selling' | 'purchase', file: File) {
    return this.http.post<PricingEnvelope<WorkbookJobAccepted>>(`${API}/${encodeURIComponent(businessId)}/pricing/workbooks/${type}/validate`, file, { withCredentials: true, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } }).pipe(map(x => x.data));
  }
  commitWorkbook(businessId: string, type: 'selling' | 'purchase', operationId: string, digest: string, choices: WorkbookDecision[]) {
    return this.http.post<PricingEnvelope<WorkbookJobAccepted>>(`${API}/${encodeURIComponent(businessId)}/pricing/workbooks/${type}/commit`, { operationId, digest, choices }, { withCredentials: true, headers: { 'Idempotency-Key': `${operationId}:${digest}` } }).pipe(map(x => x.data));
  }
  workbookJob<T>(businessId: string, jobId: string) { return this.http.get<PricingEnvelope<WorkbookJob<T>>>(`${API}/${encodeURIComponent(businessId)}/pricing/workbook-jobs/${encodeURIComponent(jobId)}`, { withCredentials: true }).pipe(map(x => x.data)); }
  workbookJobResult<T>(businessId: string, jobId: string) { return this.http.get<T>(`${API}/${encodeURIComponent(businessId)}/pricing/workbook-jobs/${encodeURIComponent(jobId)}/result`, { withCredentials: true }); }
  downloadWorkbookJob(businessId: string, jobId: string) { return this.http.get(`${API}/${encodeURIComponent(businessId)}/pricing/workbook-jobs/${encodeURIComponent(jobId)}/download`, { withCredentials: true, responseType: 'blob' }); }
}
