import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { CreditPackRecord, OfferRecord, PlanRecord, PlansOffersPage, PlansOffersResponse, TargetOption } from './plans-offers.models';
import { apiBaseUrl } from '../../app-config';

const API = `${apiBaseUrl()}/admin-setup/plans-offers`;

@Injectable({ providedIn: 'root' })
export class PlansOffersApiService {
  constructor(private readonly http: HttpClient) {}
  private page<T>(path: string, page: number, limit: number, extras: Record<string, string> = {}): Observable<PlansOffersPage<T>> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    for (const [key, value] of Object.entries(extras)) if (value) params = params.set(key, value);
    return this.http.get<PlansOffersResponse<PlansOffersPage<T>>>(`${API}/${path}`, { params, withCredentials: true }).pipe(map(response => response.data));
  }
  plans(page: number, limit: number, isActive = ''): Observable<PlansOffersPage<PlanRecord>> { return this.page('plans', page, limit, { isActive }); }
  credits(page: number, limit: number, isActive = ''): Observable<PlansOffersPage<CreditPackRecord>> { return this.page('extra-credits', page, limit, { isActive }); }
  offers(page: number, limit: number, q = '', planId = '', isActive = ''): Observable<PlansOffersPage<OfferRecord>> { return this.page('offers', page, limit, { q, planId, isActive }); }
  planOffers(id: string): Observable<OfferRecord[]> { return this.http.get<PlansOffersResponse<OfferRecord[]>>(`${API}/plans/${encodeURIComponent(id)}/offers`, { withCredentials: true }).pipe(map(response => response.data)); }
  save(kind: 'plans' | 'extra-credits' | 'offers', payload: Record<string, unknown>, id?: string): Observable<PlanRecord | CreditPackRecord | OfferRecord> {
    const url = `${API}/${kind}${id ? `/${encodeURIComponent(id)}` : ''}`;
    const request = id ? this.http.put<PlansOffersResponse<PlanRecord | CreditPackRecord | OfferRecord>>(url, payload, { withCredentials: true }) : this.http.post<PlansOffersResponse<PlanRecord | CreditPackRecord | OfferRecord>>(url, payload, { withCredentials: true });
    return request.pipe(map(response => response.data));
  }
  active(kind: 'plans' | 'extra-credits' | 'offers', id: string, isActive: boolean): Observable<void> {
    return this.http.patch<PlansOffersResponse<unknown>>(`${API}/${kind}/${encodeURIComponent(id)}/active`, { isActive }, { withCredentials: true }).pipe(map(() => undefined));
  }
  lookup(kind: 'plans' | 'users' | 'businesses' | 'business-types', q = '', ids: string[] = []): Observable<TargetOption[]> {
    const params: Record<string, string> = {};
    if (q) params['q'] = q;
    if (ids.length) params['ids'] = ids.join(',');
    return this.http.get<PlansOffersResponse<TargetOption[]>>(`${API}/lookups/${kind}`, { params, withCredentials: true }).pipe(map(response => response.data));
  }
}
