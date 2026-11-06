import { PhoneEntry } from '../../shared/phone/phone.models';

export interface OtpRequest extends PhoneEntry {}

export interface OtpRequestResult {
  expiresAt: string;
  expiresInSeconds: number;
  resendAvailableAt: string;
}

export interface LoggedInUser {
  phoneE164: string;
  userId?: string;
  name?: string;
  photoUrl?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  createdAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}
