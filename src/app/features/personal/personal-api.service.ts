import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs';
import { PersonalBill, PersonalDashboard, PersonalEnvelope } from './personal.models';

const local = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const host = window.location.hostname === '::1' ? '[::1]' : window.location.hostname;
const base = local ? `https://${host}:3000/personal` : `${window.location.origin}/personal`;

@Injectable({ providedIn: 'root' })
export class PersonalApiService {
  constructor(private readonly http: HttpClient) {}
  dashboard(query: Record<string, string | number>) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) if (value !== '') params = params.set(key, String(value));
    return this.http.get<PersonalEnvelope<PersonalDashboard>>(`${base}/dashboard`, { params, withCredentials: true }).pipe(map(response => response.data));
  }
  bill(id: string) { return this.http.get<PersonalEnvelope<PersonalBill>>(`${base}/bills/${encodeURIComponent(id)}`, { withCredentials: true }).pipe(map(response => response.data)); }
  fileUrl(url: string): string {
    const path = url.replace(/^\/personal/, '');
    const apiBase = path.startsWith('/businesses/') ? base.replace(/\/personal$/, '') : base;
    return `${apiBase}${path}`;
  }
}
