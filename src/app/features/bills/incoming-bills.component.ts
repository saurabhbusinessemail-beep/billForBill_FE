import { Component, DestroyRef, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BillsApiService } from './bills-api.service';
import { IncomingBillSummary } from './bills.models';

@Component({
  selector: 'app-incoming-bills',
  standalone: false,
  template: `
    <section class="incoming" [attr.aria-label]="'f017.receivedBills' | translate">
      <p *ngIf="loading" role="status">{{ 'common.loading' | translate }}</p>
      <p *ngIf="loadError" role="alert">{{ 'f017.loadError' | translate }}</p>
      <p *ngIf="!loading && !loadError && !bills.length">{{ 'f015.noIncomingBills' | translate }}</p>
      <ul *ngIf="!loading && !loadError">
        <li *ngFor="let bill of bills">
          <button class="bill-row" type="button" aria-haspopup="dialog" (click)="billOpened.emit(bill.id)">
            <span><strong>{{ bill.billNumber }}</strong><small>{{ bill.supplierName }} · {{ bill.billDate }}</small></span>
            <span>{{ bill.grandTotal | currency:bill.currencyCode }} <small>{{ ('f017.' + bill.status) | translate }}</small></span>
          </button>
        </li>
      </ul>
      <nav *ngIf="!loading && !loadError && (page > 1 || hasNextPage)" [attr.aria-label]="'f017.receivedBills' | translate">
        <button type="button" [disabled]="page === 1" (click)="load(page - 1)">{{ 'f015.previous' | translate }}</button>
        <span>{{ 'f015.page' | translate:{page:page} }}</span>
        <button type="button" [disabled]="!hasNextPage" (click)="load(page + 1)">{{ 'f015.next' | translate }}</button>
      </nav>
    </section>
  `,
  styles: `
    .incoming { margin-top: 1rem; padding: 1rem; border: 1px solid var(--theme-border); border-radius: .8rem; background: var(--theme-surface); }
    ul { list-style: none; margin: 0; padding: 0; }
    .bill-row { display: flex; gap: .75rem; justify-content: space-between; padding: .65rem; overflow-wrap: anywhere; }
    button { color: var(--theme-text); background: var(--theme-surface); border: 1px solid var(--theme-border); border-radius: .45rem; padding: .45rem .65rem; font: inherit; }
    .bill-row { width: 100%; text-align: start; margin-top: .4rem; cursor: pointer; }
    small { display: block; color: var(--theme-text-muted); }
    nav { display: flex; align-items: center; gap: .75rem; margin-top: .75rem; }
  `,
})
export class IncomingBillsComponent implements OnChanges {
  @Input({ required: true }) businessId = '';
  @Output() readonly billOpened = new EventEmitter<string>();
  private readonly api = inject(BillsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private listRequest = 0;
  bills: IncomingBillSummary[] = [];
  page = 1;
  hasNextPage = false;
  loading = true;
  loadError = false;

  ngOnChanges(): void { this.load(1); }

  load(page: number): void {
    const request = ++this.listRequest;
    this.page = page;
    this.loading = true;
    this.loadError = false;
    this.api.listIncomingBills(this.businessId, page).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        if (request !== this.listRequest) return;
        this.bills = result.items;
        this.hasNextPage = result.hasNextPage;
        this.loading = false;
      },
      error: () => {
        if (request !== this.listRequest) return;
        this.loading = false;
        this.loadError = true;
      },
    });
  }

}
