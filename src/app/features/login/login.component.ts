import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, catchError, interval, of, timeout } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { LanguageService } from '../../core/language/language.service';
import { COUNTRY_CODES } from '../../shared/phone/country-codes';
import { PhoneEntry } from '../../shared/phone/phone.models';
interface IpCountryResult { success?: boolean; country_code?: string; }

@Component({
  selector: 'app-login', standalone: false, templateUrl: './login.component.html', styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, OnDestroy {
  readonly countries = COUNTRY_CODES;
  readonly themeService = inject(ThemeService);
  readonly languageService = inject(LanguageService);
  readonly phoneForm: FormGroup<{
    countryRegion: FormControl<string | null>;
    phoneNumber: FormControl<string | null>;
  }>;
  readonly otpForm: FormGroup<{ otp: FormControl<string | null> }>;
  step: 'phone' | 'otp' = 'phone';
  isSubmitting = false;
  otpFocused = false;
  errorMessage = '';
  expiresAt = 0;
  remainingSeconds = 0;
  resendAvailableAt = 0;
  resendRemainingSeconds = 0;
  private countdown?: Subscription;

  constructor(private readonly formBuilder: FormBuilder, private readonly auth: AuthService, private readonly router: Router, private readonly http: HttpClient) {
    this.phoneForm = this.formBuilder.group({
      countryRegion: [this.defaultCountryRegion(), Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^[\d\s().-]{4,20}$/)]],
    });
    this.otpForm = this.formBuilder.group({ otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]] });
  }

  ngOnInit(): void {
    this.detectCountryFromIp();
    this.auth.loadLoggedInUserInfo().subscribe({
      next: () => void this.router.navigateByUrl('/dashboard'),
      error: () => undefined,
    });
  }

  ngOnDestroy(): void { this.countdown?.unsubscribe(); }

  toggleTheme(): void { this.themeService.toggleTheme(); }

  get otpDigits(): string[] {
    const otp = this.otpForm.controls.otp.value ?? '';
    return Array.from({ length: 6 }, (_, index) => otp[index] ?? '');
  }

  get phoneDisplay(): string {
    const region = this.phoneForm.controls.countryRegion.value ?? 'US';
    const callingCode = COUNTRY_CODES.find((country) => country.region === region)?.code ?? '+1';
    return `${callingCode} ${this.phoneForm.controls.phoneNumber.value ?? ''}`.trim();
  }

  requestCode(): void {
    this.errorMessage = '';
    if (this.phoneForm.invalid || this.isSubmitting) { this.phoneForm.markAllAsTouched(); return; }
    this.isSubmitting = true;
    const phone = this.phonePayload();
    this.auth.requestOtp(phone).subscribe({
      next: (result) => {
        this.isSubmitting = false;
        this.step = 'otp';
        this.otpForm.reset();
        this.expiresAt = new Date(result.expiresAt).getTime();
        this.resendAvailableAt = new Date(result.resendAvailableAt).getTime();
        this.updateCountdown();
        this.countdown?.unsubscribe();
        this.countdown = interval(1000).subscribe(() => this.updateCountdown());
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;
        this.errorMessage = this.readError(error, 'error.request');
      },
    });
  }

  verifyCode(): void {
    this.errorMessage = '';
    if (this.otpForm.invalid || this.isSubmitting || this.remainingSeconds <= 0) { this.otpForm.markAllAsTouched(); return; }
    this.isSubmitting = true;
    const phone = this.phonePayload();
    this.auth.verifyOtp(phone, this.otpForm.controls.otp.value ?? '').subscribe({
      next: () => {
        this.isSubmitting = false;
        this.countdown?.unsubscribe();
        void this.router.navigateByUrl('/dashboard');
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;
        this.errorMessage = this.readError(error, 'error.verify');
      },
    });
  }

  backToPhone(): void { this.errorMessage = ''; this.otpForm.reset(); this.step = 'phone'; }

  formatCountdown(): string {
    const minutes = Math.floor(this.remainingSeconds / 60).toString().padStart(2, '0');
    const seconds = (this.remainingSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  formatResendCountdown(): string {
    const minutes = Math.floor(this.resendRemainingSeconds / 60).toString().padStart(2, '0');
    const seconds = (this.resendRemainingSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  private updateCountdown(): void {
    this.remainingSeconds = Math.max(0, Math.ceil((this.expiresAt - Date.now()) / 1000));
    this.resendRemainingSeconds = Math.max(0, Math.ceil((this.resendAvailableAt - Date.now()) / 1000));
    if (this.remainingSeconds === 0 && this.resendRemainingSeconds === 0) this.countdown?.unsubscribe();
  }

  private phonePayload(): PhoneEntry {
    const region = this.phoneForm.controls.countryRegion.value ?? 'US';
    const country = COUNTRY_CODES.find((item) => item.region === region);
    return {
      countryCallingCode: country?.code ?? '+1',
      phoneNumber: this.phoneForm.controls.phoneNumber.value ?? '',
    };
  }

  private defaultCountryRegion(): string {
    try {
      const region = new Intl.Locale(navigator.language).region;
      return COUNTRY_CODES.find((country) => country.region === region)?.region ?? 'US';
    } catch { return 'US'; }
  }

  private detectCountryFromIp(): void {
    this.http.get<IpCountryResult>('https://ipwho.is/').pipe(
      timeout(3000),
      catchError(() => of(null)),
    ).subscribe((result) => {
      const region = result?.success === true ? result.country_code?.toUpperCase() : undefined;
      if (region && this.phoneForm.controls.countryRegion.pristine && COUNTRY_CODES.some((country) => country.region === region)) {
        this.phoneForm.controls.countryRegion.setValue(region);
      }
      this.languageService.setDetectedCountry(region);
    });
  }

  private readError(error: HttpErrorResponse, fallback: string): string {
    const code = error.error?.error?.code;
    if (code === 'INVALID_PHONE') return 'error.phone';
    if (code === 'INVALID_OTP') return 'error.verify';
    if (code === 'RATE_LIMITED') return 'error.rateLimit';
    return fallback;
  }
}
