import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { HostListener } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BusinessPlansApiService } from './business-plans-api.service';
import { AvailablePlan, ValidatedOffer } from './business-plans.models';

@Component({ selector: 'app-business-plan-purchase-dialog', standalone: false, templateUrl: './business-plan-purchase-dialog.component.html', styleUrls: ['./business-plans-dialog.component.scss'] })
export class BusinessPlanPurchaseDialogComponent implements OnInit {
  @Input({ required: true }) businessId = '';
  @Input() hasPaidPlan = false;
  @Input() initialPlanId = '';
  @Input() initialOfferCode = '';
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly purchased = new EventEmitter<void>();
  plans: AvailablePlan[] = [];
  planId = '';
  offerCode = '';
  applied: ValidatedOffer | null = null;
  loading = true;
  applying = false;
  paying = false;
  error = '';
  private idempotencyKey = crypto.randomUUID();
  constructor(private readonly api: BusinessPlansApiService) {}
  @HostListener('document:keydown.escape') onEscape(): void { this.close(); }
  close(): void { if (!this.paying) this.closed.emit(); }
  ngOnInit(): void { this.offerCode = this.initialOfferCode; this.api.availablePlans(this.businessId).subscribe({ next: rows => { this.plans = rows; this.planId = rows.some(plan => plan.id === this.initialPlanId) ? this.initialPlanId : (rows[0]?.id || ''); this.loading = false; if (this.offerCode && this.planId) this.applyOffer(); }, error: () => { this.loading = false; this.error = 'f024.catalogError'; } }); }
  get selected(): AvailablePlan | undefined { return this.plans.find(plan => plan.id === this.planId); }
  choosePlan(id: string): void { this.planId = id; this.applied = null; this.idempotencyKey = crypto.randomUUID(); }
  offerCodeChanged(value: string): void { this.offerCode = value; this.applied = null; this.error = ''; this.idempotencyKey = crypto.randomUUID(); }
  applyOffer(): void { if (!this.planId || !this.offerCode.trim()) { this.error = 'f024.offerCodeRequired'; return; } this.applying = true; this.error = ''; this.api.validateOffer(this.businessId, this.planId, this.offerCode.trim()).subscribe({ next: result => { this.applied = result; this.applying = false; }, error: (err: HttpErrorResponse) => { this.applied = null; this.applying = false; this.error = err.error?.error?.code === 'OFFER_NOT_APPLICABLE' ? 'f024.offerInvalid' : 'f024.offerError'; } }); }
  pay(): void { if (!this.planId || this.paying || (this.offerCode.trim() && !this.applied)) return; this.paying = true; this.error = ''; this.api.purchasePlan(this.businessId, this.planId, this.applied?.offer?.code || '', this.idempotencyKey).subscribe({ next: () => this.purchased.emit(), error: () => { this.paying = false; this.error = 'f024.purchaseError'; } }); }
  get discount(): number { return this.applied?.discountAmount || 0; }
  get due(): number { return this.applied?.amountDue ?? this.selected?.monthlyPrice ?? 0; }
}
