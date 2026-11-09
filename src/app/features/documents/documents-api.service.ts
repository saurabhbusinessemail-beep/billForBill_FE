import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { apiBaseUrl } from '../../app-config';
import { map, Observable } from 'rxjs';
import { ApiEnvelope, BusinessDocument, DocumentKind, DocumentOptions, DocumentPage, OrderType, ProductOption } from './documents.models';

const API = `${apiBaseUrl()}/businesses`;
@Injectable({ providedIn: 'root' })
export class DocumentsApiService {
  constructor(private readonly http: HttpClient) {}
  list<T extends BusinessDocument>(businessId: string, kind: DocumentKind, query: { page: number; search: string; status: string; orderType?: OrderType }): Observable<DocumentPage<T>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', 20);
    if (query.search) params = params.set('search', query.search);
    if (query.status) params = params.set('status', query.status);
    if (query.orderType) params = params.set('orderType', query.orderType);
    return this.http.get<ApiEnvelope<DocumentPage<T>>>(`${API}/${encodeURIComponent(businessId)}/${kind}`, { params, withCredentials: true }).pipe(map(x => x.data));
  }
  get(businessId: string, kind: DocumentKind, id: string): Observable<BusinessDocument> { return this.http.get<ApiEnvelope<BusinessDocument>>(`${API}/${encodeURIComponent(businessId)}/${kind}/${encodeURIComponent(id)}`, { withCredentials: true }).pipe(map(x => x.data)); }
  options(businessId: string, kind: DocumentKind, includeProducts = true): Observable<DocumentOptions> {
    const params = includeProducts ? undefined : { includeProducts: 'false' };
    return this.http.get<ApiEnvelope<DocumentOptions>>(`${API}/${encodeURIComponent(businessId)}/${kind}/options`, { params, withCredentials: true }).pipe(map(x => x.data));
  }
  searchOrderProducts(businessId: string, q: string): Observable<ProductOption[]> {
    return this.http.get<ApiEnvelope<ProductOption[]>>(`${API}/${encodeURIComponent(businessId)}/orders/products/search`, { params: { q }, withCredentials: true }).pipe(map(x => x.data));
  }
  create(businessId: string, kind: DocumentKind, body: unknown): Observable<BusinessDocument> { return this.http.post<ApiEnvelope<BusinessDocument>>(`${API}/${encodeURIComponent(businessId)}/${kind}`, body, { withCredentials: true, headers: { 'Idempotency-Key': crypto.randomUUID() } }).pipe(map(x => x.data)); }
  update(businessId: string, kind: DocumentKind, id: string, body: unknown): Observable<BusinessDocument> { return this.http.patch<ApiEnvelope<BusinessDocument>>(`${API}/${encodeURIComponent(businessId)}/${kind}/${encodeURIComponent(id)}`, body, { withCredentials: true }).pipe(map(x => x.data)); }
  remove(businessId: string, kind: DocumentKind, id: string): Observable<void> { return this.http.delete<ApiEnvelope<void>>(`${API}/${encodeURIComponent(businessId)}/${kind}/${encodeURIComponent(id)}`, { withCredentials: true }).pipe(map(x => x.data)); }
  convert(businessId: string, lead: BusinessDocument, mode: 'order' | 'bill', deliveryCompleted = false): Observable<BusinessDocument> { return this.http.post<ApiEnvelope<BusinessDocument>>(`${API}/${encodeURIComponent(businessId)}/leads/${encodeURIComponent(lead.id)}/convert`, { mode, version: lead.version, deliveryCompleted }, { withCredentials: true, headers: { 'Idempotency-Key': crypto.randomUUID() } }).pipe(map(x => x.data)); }
  orderAction(businessId: string, order: BusinessDocument, action: 'confirm' | 'generate_bill' | 'mark_delivered' | 'cancel', deliveryCompleted = false): Observable<BusinessDocument> { return this.http.post<ApiEnvelope<BusinessDocument>>(`${API}/${encodeURIComponent(businessId)}/orders/${encodeURIComponent(order.id)}/actions`, { action, version: order.version, deliveryCompleted }, { withCredentials: true }).pipe(map(x => x.data)); }
  lookupContact(businessId: string, kind: DocumentKind, countryCallingCode: string, phoneNumber: string) {
    const params = new HttpParams().set('countryCallingCode', countryCallingCode).set('phoneNumber', phoneNumber);
    return this.http.get<ApiEnvelope<{ exists: boolean; userId?: string; name?: string; phone?: string }>>(`${API}/${encodeURIComponent(businessId)}/${kind}/contacts/lookup`, { params, withCredentials: true }).pipe(map(x => x.data));
  }
  createImageOrder(businessId: string, orderType: OrderType, file: File, metadata: Record<string, unknown>) {
    const params = new HttpParams().set('filename', file.name);
    return this.http.post<ApiEnvelope<BusinessDocument>>(`${API}/${encodeURIComponent(businessId)}/orders/image-only`, file, { params, withCredentials: true, headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Order-Metadata': JSON.stringify({ ...metadata, orderType }) , 'Idempotency-Key': crypto.randomUUID() } }).pipe(map(x => x.data));
  }
  attachImage(businessId: string, orderId: string, file: File) {
    const params = new HttpParams().set('filename', file.name);
    return this.http.post<ApiEnvelope<{ id: string }>>(`${API}/${encodeURIComponent(businessId)}/orders/${encodeURIComponent(orderId)}/images`, file, { params, withCredentials: true, headers: { 'Content-Type': file.type || 'application/octet-stream' } }).pipe(map(x => x.data));
  }
  image(businessId: string, orderId: string, imageId: string): Observable<Blob> { return this.http.get(`${API}/${encodeURIComponent(businessId)}/orders/${encodeURIComponent(orderId)}/images/${encodeURIComponent(imageId)}`, { withCredentials: true, responseType: 'blob' }); }
  imageUrl(businessId: string, orderId: string, imageId: string): string { return `${API}/${encodeURIComponent(businessId)}/orders/${encodeURIComponent(orderId)}/images/${encodeURIComponent(imageId)}`; }
  abortImageOrder(businessId: string, orderId: string) { return this.http.delete<ApiEnvelope<{ removed: boolean }>>(`${API}/${encodeURIComponent(businessId)}/orders/${encodeURIComponent(orderId)}/image-upload`, { withCredentials: true }); }
  addTax(businessId: string, body: { name: string; calculationType: string; value: string }) { return this.http.post<ApiEnvelope<{ id: string; name: string; calculationType: 'fixed' | 'percentage'; value: number; description: string }>>(`${API}/${encodeURIComponent(businessId)}/orders/taxes`, body, { withCredentials: true }).pipe(map(x => x.data)); }
}
