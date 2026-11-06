import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs';
import { InventoryBalanceReport, InventoryLedger, InventoryList, InventoryReportOptions } from './inventory.models';
import { apiBaseUrl } from '../../app-config';
const API = `${apiBaseUrl()}/businesses`;
interface Envelope<T> { success: boolean; data: T; }
@Injectable({ providedIn: 'root' })
export class InventoryApiService {
  constructor(private readonly http: HttpClient) {}
  list(businessId: string, search = '', categoryId = '', stockLevel = '') {
    let params = new HttpParams(); if (search.trim()) params = params.set('search', search.trim()); if (categoryId) params = params.set('categoryId', categoryId); if (stockLevel) params = params.set('stockLevel', stockLevel);
    return this.http.get<Envelope<InventoryList>>(`${API}/${encodeURIComponent(businessId)}/inventory`, { params, withCredentials: true }).pipe(map(x => x.data));
  }
  adjust(businessId: string, value: { productId: string; direction: 'in' | 'out'; quantity: string; unitId: string; effectiveDate: string; reason: string; note: string }) {
    return this.http.post<Envelope<{ id: string }>>(`${API}/${encodeURIComponent(businessId)}/inventory/adjustments`, value, { withCredentials: true }).pipe(map(x => x.data));
  }
  ledger(businessId: string, productId: string) { return this.http.get<Envelope<InventoryLedger>>(`${API}/${encodeURIComponent(businessId)}/inventory/products/${encodeURIComponent(productId)}/ledger`, { withCredentials: true }).pipe(map(x => x.data)); }
  reorderLevel(businessId: string, productId: string, reorderLevel: string) { return this.http.put<Envelope<{ id: string }>>(`${API}/${encodeURIComponent(businessId)}/inventory/products/${encodeURIComponent(productId)}/reorder-level`, { reorderLevel }, { withCredentials: true }).pipe(map(x => x.data)); }
  reportOptions(businessId: string) { return this.http.get<Envelope<InventoryReportOptions>>(`${API}/${encodeURIComponent(businessId)}/reports/inventory-balance-sheet`, { withCredentials: true }).pipe(map(x => x.data)); }
  report(businessId: string, productId: string, startDate: string, endDate: string, unitId: string) {
    const params = new HttpParams().set('productId', productId).set('startDate', startDate).set('endDate', endDate).set('unitId', unitId);
    return this.http.get<Envelope<InventoryBalanceReport>>(`${API}/${encodeURIComponent(businessId)}/reports/inventory-balance-sheet`, { params, withCredentials: true }).pipe(map(x => x.data));
  }
}
