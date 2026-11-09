import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { map, Observable, Subscription, switchMap, timer } from 'rxjs';
import { InventoryApiService } from './inventory-api.service';
import { InventoryBalanceReport, InventoryProductOption, InventoryUnit } from './inventory.models';
import { BalancePeriod, Counterparty, MonetaryStatement, OPENING_BALANCES_PERMISSION, OpeningBalancesApi, ReportType } from '../opening-balances/opening-balances.api';
type Range = 'last30' | 'last3' | 'year' | 'custom';
@Component({ selector: 'app-reports-page', standalone: false, templateUrl: './reports-page.component.html', styleUrls: ['./inventory-page.component.scss', './reports-page.component.scss'] })
export class ReportsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  businessId = ''; products: InventoryProductOption[] = []; productId = ''; startDate = ''; endDate = ''; unitId = ''; range: Range = 'last3'; report: InventoryBalanceReport | null = null; loading = false; optionsLoading = true; errorKey = ''; dateError = false; filtersOpen = false;
  readonly types: ReportType[] = ['inventory', 'financial', 'overallFinancial'];
  reportType: ReportType = 'inventory';
  money: MonetaryStatement | null = null;
  parties: Counterparty[] = [];
  partyKey = '';
  partySearch = '';
  partyMatches: Counterparty[] = [];
  partySearching = false;
  partySearchError = '';
  openingPeriod: BalancePeriod | null | undefined;
  canManage = false;
  showFilterSummary = false;
  canCancelEdit = false;
  private generated = false;
  readonly rangeLabels: Record<Range, string> = {
    last30: 'f016.lastMonth', last3: 'f016.last3Months', year: 'f016.thisYear', custom: 'f016.customRange',
  };
  private request?: Subscription;
  private options = new Subscription();
  private partyLookup?: Subscription;
  private searchRequest?: Subscription;
  private searchedParty?: Counterparty;
  optionsError = '';
  partyOptionsLoading = true;
  partyOptionsError = '';
  floatingHeading = false; floatingTop = 0; floatingLeft = 0; floatingWidth = 0;
  floatingToolbar = false;
  toolbarTop = 0; toolbarInsetLeft = 0; toolbarInsetRight = 0; toolbarHeight = 0;
  private toolbarSlot: HTMLElement | null = null;
  private toolbar: HTMLElement | null = null;
  private floatingBar: HTMLElement | null = null;
  private scrollContainer: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private routeSubscription?: { unsubscribe(): void };
  private readonly updateFloatingHeading = (): void => {
    const title = document.getElementById('reports-title'); const header = document.querySelector<HTMLElement>('app-dashboard-header');
    if (!title || !header) return;
    const rect = header.getBoundingClientRect();
    this.floatingTop = rect.bottom;
    this.floatingLeft = rect.left;
    this.floatingWidth = rect.width;
    this.toolbarTop = rect.bottom + (this.floatingBar?.offsetHeight || 0);
    const slot = this.toolbarSlot?.getBoundingClientRect();
    if (slot) {
      this.toolbarInsetLeft = Math.max(0, slot.left - rect.left);
      this.toolbarInsetRight = Math.max(0, rect.right - slot.right);
    }
    if (this.toolbar?.offsetHeight) this.toolbarHeight = this.toolbar.offsetHeight;
    const before = this.floatingHeading; this.floatingHeading = title.getBoundingClientRect().top <= rect.bottom + 1 || this.filtersOpen;
    this.floatingToolbar = Boolean(this.floatingHeading && slot && slot.top <= this.toolbarTop + 1);
    if (this.floatingHeading && !before) window.requestAnimationFrame(this.updateFloatingHeading);
  };
  constructor(private readonly route: ActivatedRoute, readonly api: InventoryApiService, private readonly balances: OpeningBalancesApi) {}
  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      this.businessId = params.get('businessId') || '';
      this.products = [];
      this.parties = [];
      this.productId = this.unitId = this.partyKey = '';
      this.clearPartySearch();
      this.searchedParty = undefined;
      this.reportType = 'inventory';
      this.filtersOpen = false;
      this.canManage = false;
      this.refreshOpeningBalance();
      this.errorKey = this.optionsError = '';
      this.setRange('last3');
      this.loadOptions();
    });
  }
  ngAfterViewInit(): void {
    this.scrollContainer = document.querySelector<HTMLElement>('.workspace-content');
    this.toolbarSlot = document.querySelector<HTMLElement>('.reports__toolbar-slot');
    this.toolbar = this.toolbarSlot?.querySelector<HTMLElement>('.reports__toolbar') ?? null;
    this.floatingBar = document.querySelector<HTMLElement>('.reports__floating-bar');
    this.resizeObserver = new ResizeObserver(this.updateFloatingHeading);
    for (const element of [this.toolbarSlot, this.toolbar, this.floatingBar]) {
      if (element) this.resizeObserver.observe(element);
    }
    this.scrollContainer?.addEventListener('scroll', this.updateFloatingHeading, { passive: true });
    window.addEventListener('resize', this.updateFloatingHeading, { passive: true });
    this.updateFloatingHeading();
  }
  ngOnDestroy(): void { this.routeSubscription?.unsubscribe(); this.request?.unsubscribe(); this.options.unsubscribe(); this.partyLookup?.unsubscribe(); this.searchRequest?.unsubscribe(); this.resizeObserver?.disconnect(); this.scrollContainer?.removeEventListener('scroll', this.updateFloatingHeading); window.removeEventListener('resize', this.updateFloatingHeading); }
  private toDate(value: Date): string { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
  private today(): Date { const value = new Date(); return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
  setRange(value: Range): void { this.range = value; const end = this.today(); const start = new Date(end); if (value === 'last30') start.setDate(start.getDate() - 29); else if (value === 'last3') { const day = start.getDate(); start.setDate(1); start.setMonth(start.getMonth() - 3); start.setDate(Math.min(day, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate())); } else if (value === 'year') { start.setMonth(0, 1); } if (value !== 'custom') { this.startDate = this.toDate(start); this.endDate = this.toDate(end); } this.filtersChanged(); }
  loadOptions(): void {
    this.options.unsubscribe();
    this.options = new Subscription();
    this.optionsLoading = this.partyOptionsLoading = true;
    this.optionsError = this.partyOptionsError = '';
    this.options.add(this.api.reportOptions(this.businessId).subscribe({
      next: value => {
        this.products = value.products;
        this.canManage = value.authorization.isOwner || value.authorization.permissionKeys.includes(OPENING_BALANCES_PERMISSION);
        this.optionsLoading = false;
        this.refreshOpeningBalance();
      },
      error: error => { this.optionsLoading = false; this.optionsError = this.reportError(error); },
    }));
    this.options.add(this.balances.counterparties(this.businessId).subscribe({
      next: parties => { this.parties = parties; this.partyOptionsLoading = false; },
      error: error => { this.partyOptionsLoading = false; this.partyOptionsError = this.reportError(error); },
    }));
  }
  get inventory(): boolean { return this.reportType === 'inventory'; }
  get partyReport(): boolean { return this.reportType !== 'overallFinancial'; }
  get selectedParty(): Counterparty | undefined {
    return this.searchedParty?.key === this.partyKey ? this.searchedParty : this.parties.find(party => party.key === this.partyKey);
  }
  get canSetOpening(): boolean {
    return this.openingPeriod === null && this.canManage &&
      (this.reportType === 'overallFinancial' || (this.reportType === 'financial' && Boolean(this.selectedParty)));
  }
  selectType(type: ReportType): void {
    this.clearPartySearch();
    this.reportType = type;
    this.refreshOpeningBalance();
    this.filtersChanged();
  }
  searchParties(value: string): void {
    this.clearPartySearch();
    this.partySearch = value;
    const query = value.trim();
    if (!query) return;
    const businessId = this.businessId;
    this.partySearching = true;
    this.searchRequest = timer(300).pipe(switchMap(() => this.balances.searchCounterparties(businessId, query))).subscribe({
      next: parties => { this.partyMatches = parties; this.partySearching = false; },
      error: error => { this.partySearchError = this.reportError(error); this.partySearching = false; },
    });
  }
  private clearPartySearch(): void {
    this.searchRequest?.unsubscribe();
    this.partySearch = this.partySearchError = '';
    this.partyMatches = [];
    this.partySearching = false;
  }
  selectSearchResult(party: Counterparty): void { this.selectParty(party.key, party); }
  selectParty(key: string, party?: Counterparty): void {
    this.partyKey = key;
    this.searchedParty = party;
    this.clearPartySearch();
    this.refreshOpeningBalance();
    this.filtersChanged();
  }
  refreshOpeningBalance(): void {
    this.partyLookup?.unsubscribe();
    this.openingPeriod = undefined;
    if (!this.canManage || this.inventory || (this.partyReport && !this.selectedParty)) return;
    const keys = this.partyReport ? [this.partyKey] : undefined;
    this.partyLookup = this.balances.latest(this.businessId, keys).subscribe({
      next: result => {
        const party = result.items?.[0];
        this.openingPeriod = keys ? (party?.eligible ? party.period : undefined) : result.period;
      },
      error: () => undefined,
    });
  }
  balanceSaved(): void { this.refreshOpeningBalance(); this.filtersChanged(); }
  get selectedProduct(): InventoryProductOption | undefined { return this.products.find(item => item.id === this.productId); }
  get units(): InventoryUnit[] { return this.selectedProduct?.units || []; }
  get selectedUnit(): InventoryUnit | undefined { return this.units.find(unit => unit.id === this.unitId); }
  get reportLabel(): string { return this.inventory ? 'f016.inventoryBalanceSheet' : 'f029.' + this.reportType; }
  get canGenerate(): boolean {
    return !this.generated && !this.loading && Boolean(this.startDate && this.endDate && !this.dateError)
      && (!this.inventory || Boolean(this.selectedProduct && this.selectedUnit))
      && (this.reportType !== 'financial' || Boolean(this.selectedParty));
  }
  selectProduct(id: string): void { this.productId = id; this.unitId = this.selectedProduct?.baseUnitKey || this.units[0]?.id || ''; this.filtersChanged(); }
  editFilters(): void {
    this.canCancelEdit = true;
    this.showFilterSummary = false;
  }
  cancelEdit(): void {
    if (!this.canCancelEdit) return;
    this.canCancelEdit = false;
    this.showFilterSummary = true;
  }
  private filtersChanged(): void {
    this.request?.unsubscribe();
    this.report = this.money = null;
    this.loading = this.generated = this.showFilterSummary = false;
    this.canCancelEdit = false;
    this.dateError = Boolean(this.startDate && this.endDate && this.startDate > this.endDate);
    this.errorKey = '';
  }
  generateReport(): void {
    if (!this.canGenerate) return;
    const filters: Record<string, string> = { type: this.reportType, from: this.startDate, to: this.endDate };
    if (this.partyReport && this.selectedParty) filters['counterpartyKey'] = this.partyKey;
    const product = this.inventory ? this.selectedProduct : undefined;
    if (product) {
      Object.assign(filters, { productId: product.productId, variantKey: product.variantKey || '', unitId: this.unitId });
    }
    this.generated = this.loading = this.showFilterSummary = true;
    this.canCancelEdit = false;
    this.errorKey = '';
    this.filtersOpen = false;
    const statement: Observable<{ quantity: InventoryBalanceReport | null; money: MonetaryStatement | null } | null> =
      product && !filters['counterpartyKey']
      ? this.api.report(this.businessId, product.productId, product.variantKey || '', this.startDate, this.endDate, this.unitId)
        .pipe(map(quantity => ({ quantity, money: null })))
      : this.balances.statement(this.businessId, filters);
    this.request = statement.subscribe({
      next: value => { this.money = value?.money ?? null; this.report = value?.quantity ?? null; this.loading = false; },
      error: error => { this.generated = this.loading = false; this.errorKey = this.reportError(error); },
    });
  }
  private reportError(error: HttpErrorResponse): string {
    if (error.status === 403) return 'f016.forbidden';
    if (error.error?.error?.code === 'BALANCE_CURRENCY_MISMATCH') return 'f029.currencyMismatch';
    if (error.error?.error?.code === 'STALE_REPORT_CURSOR') return 'f029.staleReport';
    return 'f016.reportLoadError';
  }
  unitChanged(value: string): void { this.unitId = value; this.filtersChanged(); }
  setDate(field: 'startDate' | 'endDate', value: string): void { this[field] = value; this.range = 'custom'; this.filtersChanged(); }
  date(value: string): string { if (!value) return ''; const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day).toLocaleDateString(); }
  reason(row: { reason: string; direction: string }): string { const key = `f016.reason.${row.reason}`; return row.reason === 'other' ? 'f016.reason.other' : row.reason === 'opening' ? 'f016.reason.opening' : row.reason === 'count' ? 'f016.reason.count' : row.reason === 'damage' ? 'f016.reason.damage' : row.reason === 'correction' ? 'f016.reason.correction' : key; }
  print(): void { window.print(); }
  @HostListener('document:keydown.escape') escape(): void { this.filtersOpen = false; }
  @HostListener('document:click', ['$event']) outside(event: MouseEvent): void { const target = event.target as HTMLElement | null; if (this.filtersOpen && !target?.closest('.reports__filter-popup,.reports__filter-action')) this.filtersOpen = false; }
}
