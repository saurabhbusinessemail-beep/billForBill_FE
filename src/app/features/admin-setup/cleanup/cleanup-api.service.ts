import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap } from 'rxjs';
import { apiBaseUrl } from '../../../app-config';
import { CatalogApiService } from '../shared/catalog-api.service';
export interface CleanupBusiness { id: string; name: string; phone: string; }
export interface CleanupBusinessPage { items: CleanupBusiness[]; page: number; total: number; totalPages: number; }
export type CleanupScope = 'admin' | 'all' | 'business';
interface CleanupResult { scope: CleanupScope; completedBusinesses: number; deletedCounts: Record<string, number>; }
interface Envelope<T> { success: boolean; data: T; }
@Injectable({ providedIn: 'root' })
export class CleanupApiService {
  private readonly base = `${apiBaseUrl()}/maintenance`;
  constructor(private readonly http: HttpClient, private readonly catalog: CatalogApiService) {}
  businesses(page: number, q: string) { return this.http.get<Envelope<CleanupBusinessPage>>(`${this.base}/businesses`, { withCredentials: true, params: { page, q } }).pipe(map(r => r.data)); }
  clean(scope: CleanupScope, businessId?: string) {
    const path = scope === 'admin' ? 'admin-catalog' : scope === 'all' ? 'all-data' : `businesses/${encodeURIComponent(businessId || '')}/data`;
    return this.http.delete<Envelope<CleanupResult>>(`${this.base}/${path}`, { withCredentials: true }).pipe(map(r => r.data), tap({ next: () => this.catalog.clearAfterCleanup(), error: () => this.catalog.clearAfterCleanup() }));
  }
}
