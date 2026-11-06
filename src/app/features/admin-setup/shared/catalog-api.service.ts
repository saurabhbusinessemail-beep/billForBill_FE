import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { map, Observable, shareReplay, tap } from 'rxjs';
import { CatalogDeleteImpact, CatalogKind, CatalogRecord, CatalogResponse } from './catalog.models';
import { BusinessAdminService } from '../../people/business-admin.service';
import { apiBaseUrl } from '../../../app-config';

const API = apiBaseUrl();

@Injectable({ providedIn: 'root' })
export class CatalogApiService {
  private readonly productImages = new Map<string, Observable<SafeUrl>>();
  constructor(private readonly http: HttpClient, private readonly sanitizer: DomSanitizer, private readonly businessAdmin: BusinessAdminService) {}
  private path(kind: CatalogKind, businessId?: string): string { return businessId ? `${API}/businesses/${encodeURIComponent(businessId)}/catalog/${kind}` : `${API}/admin-setup/${kind}`; }
  list(kind: CatalogKind, q = '', businessId?: string): Observable<CatalogRecord[]> {
    return this.http.get<CatalogResponse<CatalogRecord[]>>(this.path(kind, businessId), { withCredentials: true, params: q ? { q } : {} }).pipe(map(r => r.data));
  }
  create(kind: CatalogKind, data: Record<string, unknown>, businessId?: string): Observable<CatalogRecord> {
    return this.http.post<CatalogResponse<CatalogRecord>>(this.path(kind, businessId), data, { withCredentials: true }).pipe(map(r => r.data), tap(() => { if (businessId) this.businessAdmin.invalidate(businessId); }));
  }
  update(kind: CatalogKind, id: string, data: Record<string, unknown>, businessId?: string): Observable<CatalogRecord> {
    return this.http.put<CatalogResponse<CatalogRecord>>(`${this.path(kind, businessId)}/${encodeURIComponent(id)}`, data, { withCredentials: true }).pipe(map(r => r.data), tap(() => { if (businessId) this.businessAdmin.invalidate(businessId); }));
  }
  delete(kind: CatalogKind, id: string, businessId?: string, scope?: 'admin-only' | 'all-copies'): Observable<{ id: string; removedLinks: number }> {
    const url = `${this.path(kind, businessId)}/${encodeURIComponent(id)}`;
    return this.http.delete<CatalogResponse<{ id: string; removedLinks: number }>>(url, { withCredentials: true, params: scope ? { scope } : {} }).pipe(map(r => r.data), tap(() => { if (businessId) this.businessAdmin.invalidate(businessId); }));
  }
  deleteImpact(kind: CatalogKind, id: string, businessId?: string): Observable<CatalogDeleteImpact> {
    return this.http.get<CatalogResponse<CatalogDeleteImpact>>(`${this.path(kind, businessId)}/${encodeURIComponent(id)}/delete-impact`, { withCredentials: true }).pipe(map(r => r.data));
  }
  saveProduct(data: Record<string, unknown>, image: File, id?: string, businessId?: string): Observable<CatalogRecord> {
    const headers = new HttpHeaders({ 'Content-Type': image.type, 'X-File-Name': encodeURIComponent(image.name), 'X-Product-Metadata': JSON.stringify(data) });
    const base = this.path('products', businessId); const url = id ? `${base}/${encodeURIComponent(id)}` : base;
    const request = id ? this.http.put<CatalogResponse<CatalogRecord>>(url, image, { headers, withCredentials: true }) : this.http.post<CatalogResponse<CatalogRecord>>(url, image, { headers, withCredentials: true });
    return request.pipe(map(r => r.data), tap(product => { this.productImages.delete(`${businessId || 'admin'}:${product.id}`); if (businessId) this.businessAdmin.invalidate(businessId); }));
  }
  productImage(id: string, businessId?: string): Observable<SafeUrl> {
    const cacheKey = `${businessId || 'admin'}:${id}`; const cached = this.productImages.get(cacheKey); if (cached) return cached;
    const headers = businessId ? new HttpHeaders({ 'X-Catalog-Business-Id': businessId }) : undefined;
    const image = this.http.get(`${API}/product-images/${encodeURIComponent(id)}`, { withCredentials: true, responseType: 'blob', headers })
      .pipe(map(blob => this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(blob))), shareReplay({ bufferSize: 1, refCount: false }));
    this.productImages.set(cacheKey, image); return image;
  }
}
