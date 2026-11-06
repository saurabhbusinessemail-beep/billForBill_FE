import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, catchError, map, tap, throwError } from 'rxjs';
import { ApiResponse, LoggedInUser, OtpRequest, OtpRequestResult } from './auth.models';

const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const localApiHost = window.location.hostname === '::1' ? '[::1]' : window.location.hostname;
const AUTH_API = isLocalHost ? `https://${localApiHost}:3000/auth` : `${window.location.origin}/auth`;

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<LoggedInUser | null>(null);

  constructor(private readonly http: HttpClient) {}

  requestOtp(phone: OtpRequest): Observable<OtpRequestResult> {
    return this.http.post<ApiResponse<OtpRequestResult>>(`${AUTH_API}/phone`, phone)
      .pipe(map((response) => response.data));
  }

  verifyOtp(phone: OtpRequest, otp: string): Observable<void> {
    return this.http.post<ApiResponse<{ authenticated: boolean }>>(
      `${AUTH_API}/otp/verify`, { ...phone, otp }, { withCredentials: true },
    ).pipe(map(() => undefined));
  }

  loadLoggedInUserInfo(): Observable<LoggedInUser> {
    return this.http.get<ApiResponse<LoggedInUser>>(
      `${AUTH_API}/loggedInUserInfo`, { withCredentials: true },
    ).pipe(
      map((response) => response.data),
      tap((user) => this.currentUser.set(user)),
      catchError((error: unknown) => {
        this.currentUser.set(null);
        return throwError(() => error);
      }),
    );
  }

  logout(): Observable<void> {
    return this.http.post<ApiResponse<{ loggedOut: boolean }>>(
      `${AUTH_API}/logout`, {}, { withCredentials: true },
    ).pipe(map(() => undefined), tap(() => this.currentUser.set(null)));
  }
}
