import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { expand, map, reduce } from 'rxjs';
import { apiBaseUrl } from '../../app-config';
import { InventoryBalanceReport } from '../inventory/inventory.models';

export const OPENING_BALANCES_PERMISSION = 'business.openingBalances.manage';
export type ReportType = 'inventory' | 'financial' | 'overallFinancial';
export type BalanceAction = 'set' | 'close';
export interface Counterparty { key: string; label: string; phone: string; roles: string[]; }
export interface BalancePeriod {
  id: string;
  currency: string;
  openingDate: string;
  openingAmount: string;
  closingDate?: string;
  closingAmount?: string;
  fallback?: boolean;
}
export interface PartyBalance { key: string; eligible: boolean; canSet: boolean; period: BalancePeriod | null; }
export interface DirectoryParty extends Counterparty { period: BalancePeriod | null; }
interface CustomerVendorDirectory extends Page<DirectoryParty> {
  total: number;
  currency: string;
  canManage: boolean;
}
interface Latest { currency: string; period?: BalancePeriod | null; items?: PartyBalance[]; }
export interface BalancePreview {
  token: string;
  confirmationRequired: boolean;
  opening: BalancePeriod | null;
  closing: BalancePeriod | null;
  successorDate: string | null;
}
export interface StatementRow {
  id: string;
  type: string;
  date: string;
  amount: string;
  balance: string;
  reference?: string;
  counterpartyLabel?: string;
}
export interface MonetaryStatement {
  currency: string;
  opening: string;
  closing: string;
  positive: string;
  negative: string;
  adjustments: string;
  rows: StatementRow[];
}
interface Statement {
  money: MonetaryStatement;
  quantity: InventoryBalanceReport | null;
  nextCursor: string | null;
}
interface Page<T> { items: T[]; nextCursor: string | null; }
interface Envelope<T> { data: T; }

@Injectable({ providedIn: 'root' })
export class OpeningBalancesApi {
  constructor(private readonly http: HttpClient) {}

  private url(businessId: string, path: string): string {
    return `${apiBaseUrl()}/businesses/${encodeURIComponent(businessId)}/opening-balances/${path}`;
  }

  private get<T>(businessId: string, path: string, params: Record<string, string> = {}) {
    return this.http.get<Envelope<T>>(this.url(businessId, path), { params, withCredentials: true }).pipe(map(response => response.data));
  }

  counterparties(businessId: string) {
    const page = (cursor = '') => this.get<Page<Counterparty>>(businessId, 'counterparties', cursor ? { cursor } : {});
    return page().pipe(
      expand(result => result.nextCursor ? page(result.nextCursor) : []),
      reduce((items, result) => items.concat(result.items), [] as Counterparty[]),
    );
  }

  searchCounterparties(businessId: string, search: string) {
    return this.get<Page<Counterparty>>(businessId, 'counterparties', { search }).pipe(map(result => result.items));
  }

  directory(businessId: string, search: string, cursor: string) {
    return this.get<CustomerVendorDirectory>(businessId, 'counterparties', {
      directory: 'true', search, ...(cursor ? { cursor } : {}),
    });
  }

  latest(businessId: string, keys?: string[]) {
    return this.get<Latest>(businessId, 'latest', keys ? { keys: keys.join(',') } : {});
  }

  statement(businessId: string, filters: Record<string, string>) {
    const page = (cursor = '') => this.get<Statement>(businessId, 'statement', { ...filters, ...(cursor ? { cursor } : {}) });
    return page().pipe(
      expand(result => result.nextCursor ? page(result.nextCursor) : []),
      reduce((full, result) => {
        if (!full) return result;
        full.money.rows.push(...result.money.rows);
        if (full.quantity && result.quantity) full.quantity.movements.push(...result.quantity.movements);
        return full;
      }, null as Statement | null),
    );
  }

  preview(businessId: string, action: BalanceAction, counterpartyKey: string, openingDate: string, amount: string) {
    const body = {
      action, scope: counterpartyKey ? 'party' : 'business',
      ...(counterpartyKey ? { counterpartyKey } : {}),
      ...(action === 'set' ? { openingDate, amount } : {}),
    };
    return this.http.post<Envelope<BalancePreview>>(this.url(businessId, 'operations/preview'), body, { withCredentials: true })
      .pipe(map(response => response.data));
  }

  commit(businessId: string, preview: BalancePreview, key: string) {
    return this.http.post(this.url(businessId, 'operations/commit'),
      { token: preview.token, confirmed: preview.confirmationRequired },
      { withCredentials: true, headers: { 'Idempotency-Key': key } });
  }
}
