import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { HostListener } from '@angular/core';
import { BusinessPlansApiService } from './business-plans-api.service';
import { AvailableExtraCredit } from './business-plans.models';

@Component({ selector: 'app-business-extra-credit-dialog', standalone: false, templateUrl: './business-extra-credit-dialog.component.html', styleUrls: ['./business-plans-dialog.component.scss'] })
export class BusinessExtraCreditDialogComponent implements OnInit {
  @Input({ required: true }) businessId = '';
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly purchased = new EventEmitter<void>();
  packs: AvailableExtraCredit[] = [];
  selectedId = '';
  loading = true;
  paying = false;
  error = '';
  private idempotencyKey = crypto.randomUUID();
  constructor(private readonly api: BusinessPlansApiService) {}
  @HostListener('document:keydown.escape') onEscape(): void { this.close(); }
  close(): void { if (!this.paying) this.closed.emit(); }
  selectPack(id: string): void { this.selectedId = id; this.idempotencyKey = crypto.randomUUID(); }
  ngOnInit(): void { this.api.availableExtraCredits(this.businessId).subscribe({ next: rows => { this.packs = rows; this.selectedId = rows[0]?.id || ''; this.loading = false; }, error: () => { this.loading = false; this.error = 'f024.catalogError'; } }); }
  pay(): void { if (!this.selectedId || this.paying) return; this.paying = true; this.error = ''; this.api.purchaseExtraCredit(this.businessId, this.selectedId, this.idempotencyKey).subscribe({ next: () => this.purchased.emit(), error: () => { this.paying = false; this.error = 'f024.purchaseError'; } }); }
}
