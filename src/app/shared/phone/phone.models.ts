import { COUNTRY_CODES } from './country-codes';

export interface PhoneEntry {
  countryCallingCode: string;
  phoneNumber: string;
}

export interface PhoneIdentity {
  phoneE164: string;
}

export function parsePhoneE164(phoneE164: string | null | undefined): PhoneEntry | null {
  if (!phoneE164 || !/^\+[1-9]\d{6,14}$/.test(phoneE164)) return null;
  const code = [...new Set(COUNTRY_CODES.map(country => country.code))]
    .sort((a, b) => b.length - a.length)
    .find(candidate => phoneE164.startsWith(candidate));
  return code ? { countryCallingCode: code, phoneNumber: phoneE164.slice(code.length) } : null;
}

export function formatPhoneE164(phoneE164: string): string {
  const parts = parsePhoneE164(phoneE164);
  return parts ? `${parts.countryCallingCode} ${parts.phoneNumber}` : phoneE164;
}
