import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AddressInput, UserProfile } from './profile.models';
import { apiBaseUrl } from '../../app-config';

const PROFILE_API = `${apiBaseUrl()}/profile`;

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  constructor(private readonly http: HttpClient) {}

  load(): Observable<UserProfile> {
    return this.http.get<{ success: boolean; data: UserProfile }>(PROFILE_API, { withCredentials: true }).pipe(map((response) => response.data));
  }

  addAddress(address: AddressInput): Observable<UserProfile> {
    return this.http.post<{ success: boolean; data: UserProfile }>(`${PROFILE_API}/addresses`, address, { withCredentials: true }).pipe(map((response) => response.data));
  }

  updateAddress(id: string, address: AddressInput): Observable<UserProfile> {
    return this.http.put<{ success: boolean; data: UserProfile }>(`${PROFILE_API}/addresses/${encodeURIComponent(id)}`, address, { withCredentials: true }).pipe(map((response) => response.data));
  }

  deleteAddress(id: string): Observable<UserProfile> {
    return this.http.delete<{ success: boolean; data: UserProfile }>(`${PROFILE_API}/addresses/${encodeURIComponent(id)}`, { withCredentials: true }).pipe(map((response) => response.data));
  }
}
