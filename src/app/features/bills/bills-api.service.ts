import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { Bill, BillEnvelope, BillsSummary, Page, Payment, PaymentRecord, PaymentsSummary, PartyBalance } from './bills.models';
import { apiBaseUrl } from '../../app-config';
const base = `${apiBaseUrl()}/businesses`;
@Injectable({ providedIn: 'root' })
export class BillsApiService {
  constructor(private readonly http: HttpClient) {}
  billSummary(id: string) { return this.http.get<BillEnvelope<BillsSummary>>(`${this.url(id)}/bills/summary`, { withCredentials: true }).pipe(map(x => x.data)); }
  lookupParty(id: string, countryCallingCode: string, phoneNumber: string) { const params = new HttpParams().set('countryCallingCode', countryCallingCode).set('phoneNumber', phoneNumber); return this.http.get<BillEnvelope<{ exists: boolean; userId?: string; name?: string; phone?: string }>>(`${this.url(id)}/bills/parties/lookup`, { params, withCredentials: true }).pipe(map(x => x.data)); }
  paymentsSummary(id: string) { return this.http.get<BillEnvelope<PaymentsSummary>>(`${this.url(id)}/payments/summary`, { withCredentials: true }).pipe(map(x => x.data)); }
  listBills(id: string, values: Record<string, string | number>) { let params = new HttpParams(); for (const [key, value] of Object.entries(values)) params = params.set(key, String(value)); return this.http.get<BillEnvelope<Page<Bill>>>(`${this.url(id)}/bills`, { params, withCredentials: true }).pipe(map(x => x.data)); }
  getBill(id: string, billId: string) { return this.http.get<BillEnvelope<Bill>>(`${this.url(id)}/bills/${encodeURIComponent(billId)}`, { withCredentials: true }).pipe(map(x => x.data)); }
  createBill(id: string, body: unknown) { return this.http.post<BillEnvelope<Bill>>(`${this.url(id)}/bills`, body, { withCredentials: true, headers: { 'Idempotency-Key': crypto.randomUUID() } }).pipe(map(x => x.data)); }
  updateDraft(id: string, billId: string, body: unknown) { return this.http.put<BillEnvelope<Bill>>(`${this.url(id)}/bills/${encodeURIComponent(billId)}`, body, { withCredentials: true }).pipe(map(x => x.data)); }
  uploadBillFile(id: string, billId: string, file: File) { const extension = file.name.split('.').pop()?.toLowerCase(); const contentType = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'application/pdf' ? file.type : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'png' ? 'image/png' : extension === 'pdf' ? 'application/pdf' : 'application/octet-stream'; return this.http.post<BillEnvelope<unknown>>(`${this.url(id)}/bills/${encodeURIComponent(billId)}/files?filename=${encodeURIComponent(file.name)}`, file, { withCredentials: true, headers: { 'Content-Type': contentType } }).pipe(map(x => x.data)); }
  billFileUrl(id: string, billId: string, fileId: string): string { return `${this.url(id)}/bills/${encodeURIComponent(billId)}/files/${encodeURIComponent(fileId)}`; }
  getBillFile(id: string, billId: string, fileId: string) { return this.http.get(this.billFileUrl(id, billId, fileId), { withCredentials: true, responseType: 'blob' }); }
  issueBill(id: string, billId: string) { return this.http.post<BillEnvelope<Bill>>(`${this.url(id)}/bills/${encodeURIComponent(billId)}/issue`, {}, { withCredentials: true }).pipe(map(x => x.data)); }
  cancelBill(id: string, billId: string) { return this.http.post<BillEnvelope<Bill>>(`${this.url(id)}/bills/${encodeURIComponent(billId)}/cancel`, {}, { withCredentials: true }).pipe(map(x => x.data)); }
  setDelivery(id: string, billId: string, deliveryStatus: string, reason = '', completionSource = '') { return this.http.post<BillEnvelope<Bill>>(`${this.url(id)}/bills/${encodeURIComponent(billId)}/delivery`, { deliveryStatus, reason, completionSource }, { withCredentials: true }).pipe(map(x => x.data)); }
  deleteDraft(id: string, billId: string) { return this.http.delete<BillEnvelope<{ deleted: boolean }>>(`${this.url(id)}/bills/${encodeURIComponent(billId)}`, { withCredentials: true }).pipe(map(x => x.data)); }
  pendingBills(id: string, partyUserId = '', direction = '') { let params = new HttpParams(); if (partyUserId) params = params.set('partyUserId', partyUserId); if (direction) params = params.set('direction', direction); return this.http.get<BillEnvelope<Bill[]>>(`${this.url(id)}/payments/pending-bills`, { params, withCredentials: true }).pipe(map(x => x.data)); }
  listPayments(id: string, page = 1, filters: Record<string, string> = {}) { let params = new HttpParams().set('page', page); for (const [key, value] of Object.entries(filters)) if (value) params = params.set(key, value); return this.http.get<BillEnvelope<Page<Payment>>>(`${this.url(id)}/payments`, { params, withCredentials: true }).pipe(map(x => x.data)); }
  listPartyBalances(id: string, filters: Record<string, string> = {}) { let params = new HttpParams(); for (const [key, value] of Object.entries(filters)) if (value) params = params.set(key, value); return this.http.get<BillEnvelope<{items: PartyBalance[]; total: number; authorization: {isOwner: boolean; permissionKeys: string[]}}>>(`${this.url(id)}/payments/party-balances`, { params, withCredentials: true }).pipe(map(x => x.data)); }
  getPayment(id: string, paymentId: string) { return this.http.get<BillEnvelope<PaymentRecord>>(`${this.url(id)}/payments/${encodeURIComponent(paymentId)}`, { withCredentials: true }).pipe(map(x => x.data)); }
  createPayment(id: string, body: unknown) { return this.http.post<BillEnvelope<Payment>>(`${this.url(id)}/payments`, body, { withCredentials: true, headers: { 'Idempotency-Key': crypto.randomUUID() } }).pipe(map(x => x.data)); }
  reversePayment(id: string, paymentId: string, reason: string) { return this.http.post<BillEnvelope<unknown>>(`${this.url(id)}/payments/${encodeURIComponent(paymentId)}/reverse`, { reason }, { withCredentials: true }).pipe(map(x => x.data)); }
  methodConfig(id: string): Observable<Record<string, Record<string, string>>> { return this.http.get<BillEnvelope<Record<string, Record<string, string>>>>(`${this.url(id)}/payment-method-config`, { withCredentials: true }).pipe(map(x => x.data)); }
  saveMethodConfig(id: string, fields: Record<string, Record<string, string>>) { return this.http.put<BillEnvelope<Record<string, Record<string, string>>>>(`${this.url(id)}/payment-method-config`, { fields }, { withCredentials: true }).pipe(map(x => x.data)); }
  numberConfig(id: string) { return this.http.get<BillEnvelope<Record<string, string>>>(`${this.url(id)}/document-number-config`, { withCredentials: true }).pipe(map(x => x.data)); }
  saveNumberConfig(id: string, fields: Record<string, string>) { return this.http.put<BillEnvelope<Record<string, string>>>(`${this.url(id)}/document-number-config`, { fields }, { withCredentials: true }).pipe(map(x => x.data)); }
  transportConfig(id: string) { return this.http.get<BillEnvelope<Record<string, Record<string, boolean>>>>(`${this.url(id)}/transport-config`, { withCredentials: true }).pipe(map(x => x.data)); }
  saveTransportConfig(id: string, fields: Record<string, Record<string, boolean>>) { return this.http.put<BillEnvelope<Record<string, Record<string, boolean>>>>(`${this.url(id)}/transport-config`, { fields }, { withCredentials: true }).pipe(map(x => x.data)); }
  private url(id: string) { return `${base}/${encodeURIComponent(id)}`; }
}
