import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SharedModule } from '../../shared/shared.module';
import { BalanceAction, BalancePeriod, BalancePreview, OpeningBalancesApi } from './opening-balances.api';

@Component({
  selector: 'app-opening-balance-dialog',
  imports: [SharedModule, FormsModule],
  template: `
    <dialog #dialog [attr.aria-label]="(action === 'close' ? 'f029.close' : 'f029.set') | translate"
      (cancel)="onCancel($event)" (click)="onBackdrop($event)">
      <form (ngSubmit)="submit()">
        <h2>{{ (action === 'close' ? 'f029.close' : 'f029.set') | translate }}</h2>
        <p *ngIf="label">{{ label }}</p>
        <p *ngIf="current as period">
          {{ 'f016.openingBalance' | translate }} · {{ period.openingDate }} · {{ period.openingAmount }} {{ period.currency }}
          · {{ (period.closingDate ? 'f029.closed' : 'f029.open') | translate }}
        </p>
        <ng-container *ngIf="!review && action === 'set'">
          <label>{{ 'f029.amount' | translate }} ({{ currency }})
            <input name="amount" [(ngModel)]="amount" inputmode="decimal" maxlength="18" required [disabled]="busy">
          </label>
          <label>{{ 'f029.date' | translate }}
            <input name="date" [(ngModel)]="date" type="date" [max]="today" required [disabled]="busy">
          </label>
        </ng-container>
        <ng-container *ngIf="review as result">
          <p *ngIf="result.closing as closing">
            {{ 'f029.confirmClose' | translate }} {{ closing.openingDate }} ({{ closing.openingAmount }} {{ closing.currency }})
            → {{ closing.closingDate }} ({{ closing.closingAmount }} {{ closing.currency }}).
          </p>
          <p *ngIf="result.successorDate">{{ 'f029.nextOpening' | translate }} {{ result.successorDate }}</p>
          <p *ngIf="result.opening as opening">
            {{ 'f029.newOpening' | translate }} {{ opening.openingDate }} · {{ opening.openingAmount }} {{ opening.currency }}
          </p>
          <p *ngIf="result.closing?.fallback">{{ 'f029.zeroFallback' | translate }}</p>
        </ng-container>
        <p *ngIf="busy" role="status">{{ 'f016.loading' | translate }}</p>
        <p *ngIf="error" role="alert">
          {{ error | translate }}
          <ng-container *ngIf="conflict as period">
            {{ period.openingDate }} ({{ period.openingAmount }} {{ period.currency }})
            <ng-container *ngIf="period.closingDate; else stillOpen">– {{ period.closingDate }} ({{ 'f029.atConfirmation' | translate }} {{ period.closingAmount }} {{ period.currency }})</ng-container>
            <ng-template #stillOpen>· {{ 'f029.open' | translate }}</ng-template>
          </ng-container>
        </p>
        <footer>
          <button type="button" (click)="dismiss()" [disabled]="busy">{{ 'business.cancel' | translate }}</button>
          <button type="submit" [disabled]="busy">{{ (review ? 'f029.confirm' : action === 'close' ? 'f029.review' : 'f029.save') | translate }}</button>
        </footer>
      </form>
    </dialog>
  `,
  styles: [`
    dialog { width: min(30rem, calc(100% - 2rem)); max-height: 90dvh; border-radius: .75rem; text-align: start;
      padding: 1.25rem; border: 1px solid var(--theme-border); background: var(--theme-surface, Canvas);
      color: var(--theme-text, CanvasText); }
    dialog::backdrop { background: rgb(0 0 0 / 55%); }
    h2 { margin: 0 0 .75rem; }
    label { display: grid; gap: .35rem; margin-block: .75rem; }
    input, button { font: inherit; padding: .55rem; color: inherit; border-radius: .45rem;
      border: 1px solid var(--theme-border); background: var(--theme-surface-raised, Canvas); }
    footer { display: flex; justify-content: flex-end; gap: .5rem; }
  `],
})
export class OpeningBalanceDialogComponent {
  @Input({ required: true }) businessId = '';
  @Output() readonly saved = new EventEmitter<void>();
  @ViewChild('dialog', { static: true }) private dialog!: ElementRef<HTMLDialogElement>;

  action: BalanceAction = 'set';
  label = '';
  currency = 'INR';
  date = '';
  today = '';
  amount = '';
  busy = false;
  error = '';
  conflict: BalancePeriod | null = null;
  current: BalancePeriod | null = null;
  review: BalancePreview | null = null;
  private counterpartyKey = '';
  private operationKey = '';
  private activeBusiness = '';
  private opener?: HTMLElement;

  constructor(private readonly api: OpeningBalancesApi) {}

  async open(action: BalanceAction = 'set', counterpartyKey = '', label = ''): Promise<void> {
    if (this.dialog.nativeElement.open) return;
    this.activeBusiness = this.businessId;
    this.action = action;
    this.counterpartyKey = counterpartyKey;
    this.label = label;
    this.today = this.date = new Date().toISOString().slice(0, 10);
    this.amount = this.error = '';
    this.conflict = null;
    this.current = this.review = null;
    this.currency = 'INR';
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.dialog.nativeElement.showModal();
    this.busy = true;
    try {
      const result = await firstValueFrom(this.api.latest(this.activeBusiness, counterpartyKey ? [counterpartyKey] : undefined));
      this.currency = result.currency;
      this.current = result.period ?? result.items?.[0]?.period ?? null;
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy = false;
    }
  }

  async submit(): Promise<void> {
    if (this.busy || this.activeBusiness !== this.businessId) return;
    this.busy = true;
    this.error = '';
    this.conflict = null;
    try {
      if (!this.review) {
        const result = await firstValueFrom(this.api.preview(this.activeBusiness, this.action, this.counterpartyKey, this.date, this.amount));
        if (this.activeBusiness !== this.businessId) { this.close(); return; }
        this.review = result;
        this.operationKey = crypto.randomUUID();
        if (result.confirmationRequired) return;
      }
      await firstValueFrom(this.api.commit(this.activeBusiness, this.review, this.operationKey));
      this.close();
      if (this.activeBusiness === this.businessId) this.saved.emit();
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500) this.review = null;
      this.showError(error);
    } finally {
      this.busy = false;
    }
  }

  onCancel(event: Event): void { event.preventDefault(); this.dismiss(); }
  onBackdrop(event: MouseEvent): void { if (event.target === this.dialog.nativeElement) this.dismiss(); }
  dismiss(): void { if (!this.busy) this.close(); }

  private close(): void {
    this.dialog.nativeElement.close();
    this.opener?.focus();
  }

  private showError(error: unknown): void {
    const response = error instanceof HttpErrorResponse ? error.error?.error : undefined;
    this.error = response?.code === 'STALE_BALANCE_PREVIEW' ? 'f029.stale'
      : response?.code === 'BALANCE_DATE_OVERLAP' ? 'f029.overlap'
      : response?.code === 'INVALID_AMOUNT' ? 'f029.invalidAmount'
      : response?.code === 'BALANCE_CURRENCY_MISMATCH' ? 'f029.currencyMismatch' : 'f029.error';
    this.conflict = response?.code === 'BALANCE_DATE_OVERLAP' ? response.details : null;
  }
}
