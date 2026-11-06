import { HttpClient, HttpParams } from '@angular/common/http';
import { effect, Injectable } from '@angular/core';
import { Observable, catchError, map, shareReplay, tap, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PhoneEntry } from '../../shared/phone/phone.models';
import { BusinessAuthorization, Envelope, Overview, Page, Permission, Person, Team, TeamPeople } from './people.models';
import { apiBaseUrl } from '../../app-config';
const base = `${apiBaseUrl()}/businesses`;
@Injectable({ providedIn: 'root' })
export class BusinessAdminService {
  private cache = new Map<string, { until: number; value: Observable<unknown> }>();
  private userId = '';
  constructor(private http: HttpClient, private auth: AuthService) { effect(() => { const id = this.auth.currentUser()?.userId ?? ''; if (id !== this.userId) { this.cache.clear(); this.userId = id; } }); }
  overview(id: string) { return this.get<Overview>(`overview:${id}`, `${this.url(id)}/overview`); }
  catalogAuthorization(id: string) { return this.get<BusinessAuthorization>(`catalog-auth:${id}`, `${this.url(id)}/catalog-authorization`); }
  refreshCatalogAuthorization(id: string) { return this.http.get<Envelope<BusinessAuthorization>>(`${this.url(id)}/catalog-authorization`, { withCredentials: true }).pipe(map(x => x.data)); }
  people(id: string, search = '', page = 1) { const params = new HttpParams().set('search', search).set('page', page); return this.get<Page<Person>>(`people:${id}:${page}:${search}`, `${this.url(id)}/people`, params); }
  teams(id: string, search = '', page = 1) { const params = new HttpParams().set('search', search).set('page', page); return this.get<Page<Team>>(`teams:${id}:${page}:${search}`, `${this.url(id)}/teams`, params); }
  team(id: string, tid: string) { return this.get<Team>(`team:${id}:${tid}`, `${this.url(id)}/teams/${tid}`); }
  members(id: string, tid: string) { return this.get<TeamPeople>(`members:${id}:${tid}`, `${this.url(id)}/teams/${tid}/members`); }
  permissions(id: string, tid: string) { return this.get<{ permissions: Permission[]; authorization?: BusinessAuthorization }>(`permissions:${id}:${tid}`, `${this.url(id)}/teams/${tid}/permissions`); }
  catalog(id: string) { return this.get<Permission[]>(`catalog:${id}`, `${this.url(id)}/permissions`, undefined, 24 * 60 * 60 * 1000); }
  lookup(id: string, phone: PhoneEntry) { const params = new HttpParams().set('countryCallingCode', phone.countryCallingCode).set('phoneNumber', phone.phoneNumber); return this.http.get<Envelope<{ exists: boolean; alreadyAdded?: boolean; user?: Person }>>(`${this.url(id)}/people/lookup`, { params, withCredentials: true }).pipe(map(x => x.data)); }
  addPerson(id: string, payload: PhoneEntry & { name?: string }) { return this.http.post<Envelope<{ person: Person }>>(`${this.url(id)}/people`, payload, { withCredentials: true }).pipe(map(x => x.data), tap(() => this.invalidate(id))); }
  removePerson(id: string, uid: string) { return this.mutate(`${this.url(id)}/people/${uid}`, 'delete', id); }
  saveTeam(id: string, value: { id?: string; name: string; description: string }) { const req = value.id ? this.http.patch<Envelope<Team>>(`${this.url(id)}/teams/${value.id}`, value, { withCredentials: true }) : this.http.post<Envelope<Team>>(`${this.url(id)}/teams`, value, { withCredentials: true }); return req.pipe(map(x => x.data), tap(() => this.invalidate(id))); }
  deleteTeam(id: string, tid: string) { return this.mutate(`${this.url(id)}/teams/${tid}`, 'delete', id); }
  member(id: string, tid: string, uid: string, add: boolean) { return this.mutate(`${this.url(id)}/teams/${tid}/members/${uid}`, add ? 'put' : 'delete', id); }
  setPermissions(id: string, tid: string, keys: string[]) { return this.http.put<Envelope<{ permissions: Permission[] }>>(`${this.url(id)}/teams/${tid}/permissions`, { permissionKeys: keys }, { withCredentials: true }).pipe(map(x => x.data.permissions), tap(() => this.invalidate(id))); }
  invalidate(id: string) { for (const key of this.cache.keys()) if (key.includes(`:${id}`)) this.cache.delete(key); }
  clear() { this.cache.clear(); }
  private url(id: string) { return `${base}/${encodeURIComponent(id)}`; }
  private get<T>(key: string, url: string, params?: HttpParams, ttl = 15000): Observable<T> { const uid = this.auth.currentUser()?.userId ?? ''; if (uid !== this.userId) { this.cache.clear(); this.userId = uid; } const scoped = `${uid}:${key}`; const found = this.cache.get(scoped); if (found && found.until > Date.now()) return found.value as Observable<T>; const value = this.http.get<Envelope<T>>(url, { params, withCredentials: true }).pipe(map(x => x.data), catchError(error => { this.cache.delete(scoped); return throwError(() => error); }), shareReplay({ bufferSize: 1, refCount: false })); this.cache.set(scoped, { until: Date.now() + ttl, value }); return value; }
  private mutate(url: string, method: 'delete' | 'put', businessId: string) { const req = method === 'delete' ? this.http.delete<Envelope<unknown>>(url, { withCredentials: true }) : this.http.put<Envelope<unknown>>(url, {}, { withCredentials: true }); return req.pipe(map(() => undefined), tap(() => this.invalidate(businessId))); }
}
