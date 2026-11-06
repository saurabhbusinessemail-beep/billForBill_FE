import { environment } from '../environments/environment';

export function apiBaseUrl(): string {
  if (!environment.apiBaseUrl) return window.location.origin;

  const host = window.location.hostname === '::1' ? '[::1]' : window.location.hostname;
  return environment.apiBaseUrl
    .replace('{host}', host)
    .replace('{origin}', window.location.origin)
    .replace(/\/$/, '');
}
