import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, catchError, map, shareReplay, tap, throwError } from 'rxjs';
import { ApiResponse, LoggedInUser, OtpRequest, OtpRequestResult } from './auth.models';
import { apiBaseUrl } from '../../app-config';

const AUTH_API = `${apiBaseUrl()}/auth`;
const LOGGED_IN_USER_INFO_TTL_MS = 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<LoggedInUser | null>(null);
  private loggedInUserInfoCache: { expiresAt: number; request: Observable<LoggedInUser> } | null = null;

  constructor(private readonly http: HttpClient) {}

  requestOtp(phone: OtpRequest): Observable<OtpRequestResult> {
    return this.http.post<ApiResponse<OtpRequestResult>>(`${AUTH_API}/phone`, phone)
      .pipe(map((response) => response.data));
  }

  verifyOtp(phone: OtpRequest, otp: string): Observable<void> {
    return this.http.post<ApiResponse<{ authenticated: boolean }>>(
      `${AUTH_API}/otp/verify`, { ...phone, otp }, { withCredentials: true },
    ).pipe(map(() => undefined), tap(() => this.invalidateLoggedInUserInfo()));
  }

  loadLoggedInUserInfo(): Observable<LoggedInUser> {
    const cached = this.loggedInUserInfoCache;
    if (cached && cached.expiresAt > Date.now()) return cached.request;

    let entry: { expiresAt: number; request: Observable<LoggedInUser> };
    const request = this.http.get<ApiResponse<LoggedInUser>>(
      `${AUTH_API}/loggedInUserInfo`, { withCredentials: true },
    ).pipe(
      map((response) => response.data),
      tap((user) => this.currentUser.set(user)),
      catchError((error: unknown) => {
        if (this.loggedInUserInfoCache === entry) this.loggedInUserInfoCache = null;
        this.currentUser.set(null);
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    entry = { expiresAt: Date.now() + LOGGED_IN_USER_INFO_TTL_MS, request };
    this.loggedInUserInfoCache = entry;
    return request;
  }

  logout(): Observable<void> {
    return this.http.post<ApiResponse<{ loggedOut: boolean }>>(
      `${AUTH_API}/logout`, {}, { withCredentials: true },
    ).pipe(map(() => undefined), tap(() => {
      this.invalidateLoggedInUserInfo();
      this.currentUser.set(null);
    }));
  }

  private invalidateLoggedInUserInfo(): void { this.loggedInUserInfoCache = null; }
}
