import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PlansOffersApiService } from './plans-offers-api.service';
import { CreditPackRecord, OfferRecord, PlanRecord, PlansOffersPage, PlansOffersTab, TargetOption } from './plans-offers.models';

type FormKind = 'plans' | 'extra-credits' | 'offers';
interface PlanDraft { name: string; monthlyPrice: number | null; includedBills: number | null; isActive: boolean; }
interface CreditDraft { code: string; name: string; price: number | null; billCount: number | null; isActive: boolean; }
interface OfferDraft { name: string; code: string; discountType: 'percent' | 'flat'; amount: number | null; planIds: string[]; userIds: string[]; businessIds: string[]; businessTypeIds: string[]; validTill: string; isActive: boolean; }

@Component({ selector: 'app-plans-offers-page', standalone: false, templateUrl: './plans-offers-page.component.html', styleUrls: ['./plans-offers-page.component.scss'] })
export class PlansOffersPageComponent implements OnInit, OnDestroy {
  readonly pageSize = 10;
  readonly businessTypeKeys = ['Grocery', 'Restaurant', 'Pharmacy', 'Clothing', 'Electronics', 'Wholesale', 'Services', 'Other'];
  tab: PlansOffersTab = 'plans';
  plans: PlanRecord[] = []; credits: CreditPackRecord[] = []; offers: OfferRecord[] = [];
  plansPage: PlansOffersPage<PlanRecord> | null = null; creditsPage: PlansOffersPage<CreditPackRecord> | null = null; offersPage: PlansOffersPage<OfferRecord> | null = null;
  page = 1; totalPages = 1; loading = false; loadError = false; saving = false; saveError = false;
  toggleError = false;
  search = ''; planFilter = ''; activeFilter = ''; private searchTimer: ReturnType<typeof setTimeout> | null = null;
  expandedPlanId = ''; relatedOffers: OfferRecord[] = []; relatedLoading = false;
  dialogKind: FormKind | null = null; editingId = '';
  planDraft: PlanDraft = this.emptyPlan(); creditDraft: CreditDraft = this.emptyCredit(); offerDraft: OfferDraft = this.emptyOffer();
  planOptions: TargetOption[] = []; userOptions: TargetOption[] = []; businessOptions: TargetOption[] = []; businessTypes: TargetOption[] = [];
  selectedPlans: TargetOption[] = []; selectedUsers: TargetOption[] = []; selectedBusinesses: TargetOption[] = [];
  planSearch = ''; userSearch = ''; businessSearch = ''; activeLookup: 'plans' | 'users' | 'businesses' | null = null;

  constructor(readonly auth: AuthService, private readonly api: PlansOffersApiService) {}
  ngOnInit(): void { this.load(); this.api.lookup('plans').subscribe({ next: rows => this.planOptions = rows }); }
  ngOnDestroy(): void { if (this.searchTimer) clearTimeout(this.searchTimer); }
  get isSuperAdmin(): boolean { return this.auth.currentUser()?.isSuperAdmin === true; }
  get addLabel(): string { return this.tab === 'plans' ? 'f023.addPlan' : this.tab === 'credits' ? 'f023.addCredit' : 'f023.addOffer'; }
  get sectionTitle(): string { return this.tab === 'plans' ? 'f023.monthlyPlans' : this.tab === 'credits' ? 'f023.creditPacks' : 'f023.offers'; }
  get sectionSubtitle(): string { return this.tab === 'plans' ? 'f023.monthlyPlansHint' : this.tab === 'credits' ? 'f023.creditPacksHint' : 'f023.offersHint'; }
  setTab(tab: PlansOffersTab): void { if (this.tab === tab) return; this.tab = tab; this.page = 1; this.search = ''; this.planFilter = ''; this.activeFilter = ''; this.expandedPlanId = ''; this.load(); }
  load(): void {
    this.loading = true; this.loadError = false;
    const req = (this.tab === 'plans' ? this.api.plans(this.page, this.pageSize, this.activeFilter) : this.tab === 'credits' ? this.api.credits(this.page, this.pageSize, this.activeFilter) : this.api.offers(this.page, this.pageSize, this.search, this.planFilter, this.activeFilter)) as Observable<PlansOffersPage<PlanRecord | CreditPackRecord | OfferRecord>>;
    req.subscribe({ next: result => { this.totalPages = Math.max(1, result.totalPages); if (this.tab === 'plans') { this.plansPage = result as PlansOffersPage<PlanRecord>; this.plans = this.plansPage.items; } else if (this.tab === 'credits') { this.creditsPage = result as PlansOffersPage<CreditPackRecord>; this.credits = this.creditsPage.items; } else { this.offersPage = result as PlansOffersPage<OfferRecord>; this.offers = this.offersPage.items; } this.loading = false; }, error: () => { this.loading = false; this.loadError = true; } });
  }
  onSearch(): void { if (this.searchTimer) clearTimeout(this.searchTimer); this.searchTimer = setTimeout(() => { this.page = 1; this.load(); }, 250); }
  setPlanFilter(value: string): void { this.planFilter = value; this.page = 1; this.load(); }
  setActiveFilter(value: string): void { this.activeFilter = value; this.page = 1; this.load(); }
  changePage(delta: number): void { this.page = Math.max(1, Math.min(this.totalPages, this.page + delta)); this.load(); }
  retry(): void { this.load(); }
  toggleActive(kind: FormKind, record: PlanRecord | CreditPackRecord | OfferRecord, event: Event): void {
    if (!this.isSuperAdmin) return;
    const input = event.target as HTMLInputElement; const previous = record.isActive; record.isActive = input.checked;
    const apiKind = kind === 'extra-credits' ? 'extra-credits' : kind;
    this.toggleError = false;
    this.api.active(apiKind, record.id, record.isActive).subscribe({ error: () => { record.isActive = previous; input.checked = previous; this.toggleError = true; } });
  }
  togglePlan(plan: PlanRecord): void { if (this.expandedPlanId === plan.id) { this.expandedPlanId = ''; return; } this.expandedPlanId = plan.id; this.relatedLoading = true; this.relatedOffers = []; this.api.planOffers(plan.id).subscribe({ next: rows => { this.relatedOffers = rows; this.relatedLoading = false; }, error: () => { this.relatedLoading = false; } }); }
  startCreate(): void { this.editingId = ''; this.saveError = false; this.dialogKind = this.tab === 'plans' ? 'plans' : this.tab === 'credits' ? 'extra-credits' : 'offers'; this.planDraft = this.emptyPlan(); this.creditDraft = this.emptyCredit(); this.offerDraft = this.emptyOffer(); this.loadTargetOptions(); }
  editPlan(row: PlanRecord): void { this.dialogKind = 'plans'; this.editingId = row.id; this.planDraft = { name: row.name, monthlyPrice: row.monthlyPrice, includedBills: row.includedBills, isActive: row.isActive }; this.saveError = false; }
  editCredit(row: CreditPackRecord): void { this.dialogKind = 'extra-credits'; this.editingId = row.id; this.creditDraft = { code: row.code, name: row.name, price: row.price, billCount: row.billCount, isActive: row.isActive }; this.saveError = false; }
  editOffer(row: OfferRecord): void {
    this.dialogKind = 'offers'; this.editingId = row.id; this.saveError = false;
    this.offerDraft = { name: row.name, code: row.code, discountType: row.discountType, amount: row.amount, planIds: [...row.planIds], userIds: [...row.userIds], businessIds: [...row.businessIds], businessTypeIds: [...row.businessTypeIds], validTill: row.validTill, isActive: row.isActive };
    this.selectedPlans = row.planIds.map(id => ({ id, name: id })); this.selectedUsers = row.userIds.map(id => ({ id, name: id })); this.selectedBusinesses = row.businessIds.map(id => ({ id, name: id })); this.loadTargetOptions();
    this.api.lookup('plans', '', row.planIds).subscribe({ next: rows => this.selectedPlans = rows });
    this.api.lookup('users', '', row.userIds).subscribe({ next: rows => this.selectedUsers = rows });
    this.api.lookup('businesses', '', row.businessIds).subscribe({ next: rows => this.selectedBusinesses = rows });
  }
  private loadTargetOptions(): void { this.api.lookup('plans').subscribe({ next: rows => this.planOptions = rows }); this.api.lookup('business-types').subscribe({ next: rows => this.businessTypes = rows }); }
  closeDialog(): void { this.dialogKind = null; this.activeLookup = null; }
  save(): void {
    if (!this.dialogKind || this.saving) return;
    const kind = this.dialogKind; let payload: Record<string, unknown>;
    if (kind === 'plans') payload = { ...this.planDraft };
    else if (kind === 'extra-credits') payload = { ...this.creditDraft };
    else payload = { ...this.offerDraft, planIds: this.selectedPlans.map(row => row.id), userIds: this.selectedUsers.map(row => row.id), businessIds: this.selectedBusinesses.map(row => row.id) };
    this.saving = true; this.saveError = false;
    this.api.save(kind, payload, this.editingId || undefined).subscribe({ next: () => { this.saving = false; this.closeDialog(); this.page = 1; this.load(); }, error: () => { this.saving = false; this.saveError = true; } });
  }
  searchTargets(kind: 'plans' | 'users' | 'businesses', value: string): void {
    this.activeLookup = kind;
    const field = kind === 'plans' ? 'planSearch' : kind === 'users' ? 'userSearch' : 'businessSearch'; this[field] = value;
    if (kind === 'plans') { if (value.length < 1) { this.api.lookup('plans').subscribe({ next: rows => this.planOptions = rows }); return; } this.api.lookup('plans', value).subscribe({ next: rows => this.planOptions = rows }); }
    if (kind === 'users' && value.length >= 2) this.api.lookup('users', value).subscribe({ next: rows => this.userOptions = rows });
    if (kind === 'businesses' && value.length >= 2) this.api.lookup('businesses', value).subscribe({ next: rows => this.businessOptions = rows });
  }
  chooseTarget(kind: 'plans' | 'users' | 'businesses', option: TargetOption): void {
    const selected = kind === 'plans' ? this.selectedPlans : kind === 'users' ? this.selectedUsers : this.selectedBusinesses;
    const index = selected.findIndex(item => item.id === option.id);
    if (index >= 0) selected.splice(index, 1); else selected.push(option);
    if (kind === 'plans') this.offerDraft.planIds = selected.map(item => item.id);
    if (kind === 'users') this.offerDraft.userIds = selected.map(item => item.id);
    if (kind === 'businesses') this.offerDraft.businessIds = selected.map(item => item.id);
  }
  isSelected(kind: 'plans' | 'users' | 'businesses', id: string): boolean { return (kind === 'plans' ? this.selectedPlans : kind === 'users' ? this.selectedUsers : this.selectedBusinesses).some(item => item.id === id); }
  removeTarget(kind: 'plans' | 'users' | 'businesses', id: string): void { const selected = kind === 'plans' ? this.selectedPlans : kind === 'users' ? this.selectedUsers : this.selectedBusinesses; const index = selected.findIndex(item => item.id === id); if (index >= 0) selected.splice(index, 1); }
  toggleBusinessType(id: string): void { const values = this.offerDraft.businessTypeIds; const index = values.indexOf(id); if (index >= 0) values.splice(index, 1); else values.push(id); }
  trackById(_index: number, row: { id: string }): string { return row.id; }
  planName(id: string): string { return this.planOptions.find(plan => plan.id === id)?.name || id.slice(-6); }
  private emptyPlan(): PlanDraft { return { name: '', monthlyPrice: null, includedBills: null, isActive: true }; }
  private emptyCredit(): CreditDraft { return { code: '', name: '', price: null, billCount: null, isActive: true }; }
  private emptyOffer(): OfferDraft { return { name: '', code: '', discountType: 'percent', amount: null, planIds: [], userIds: [], businessIds: [], businessTypeIds: [], validTill: '', isActive: true }; }
}
