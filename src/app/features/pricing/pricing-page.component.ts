import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { BusinessAdminService } from '../people/business-admin.service';
import { PricingApiService } from './pricing-api.service';
import { PricedProduct, PricingCategory, PricingCustomer, PricingRule, VariantPrice } from './pricing.models';
import { COUNTRY_CODES } from '../../shared/phone/country-codes';
import { parsePhoneE164 } from '../../shared/phone/phone.models';
import { AuthService } from '../../core/auth/auth.service';
import { WorkbookDecision, WorkbookValidation } from './pricing.models';

type Tab = 'selling' | 'purchase';
@Component({ selector: 'app-pricing-page', standalone: false, templateUrl: './pricing-page.component.html' })
export class PricingPageComponent implements OnInit, OnDestroy, AfterViewInit {
  businessId = ''; tab: Tab = 'selling'; rows: PricedProduct[] = []; categories: PricingCategory[] = []; customers: PricingCustomer[] = []; selectedCustomerId = '';
  loading = true; saving = false; errorKey = ''; noticeKey = ''; search = ''; categoryId = '';
  categoryQuery = ''; categoryOpen = false;
  page = 1; hasNextPage = false;
  canView = false; canManage = false; canImport = false; canExport = false;
  editor: 'purchase' | 'selling' | null = null; current: PricedProduct | null = null;
  purchaseCost = ''; taxInclusive = true; separateTaxAmount = ''; separateTaxId = '';
  defaultSellingPrice = ''; rules: PricingRule[] = [];
  variantPrices: Array<VariantPrice & { label: string }> = [];
  readonly durationBases = ['day', 'hour', 'minute', 'second'];
  get servicePricing(): boolean { return ['Service', 'Services'].includes(this.current?.type || ''); }
  private editVariantPrices(row: PricedProduct): void {
    this.variantPrices = row.variations.map(variant => ({
      ...(row.variantPrices.find(price => price.variantKey === variant.key) || {
        variantKey: variant.key, basis: 'fixed', sellingPrice: null, purchaseCost: null,
      }),
      label: Object.entries(variant.values).map(([name, value]) => `${name}: ${value}`).join(', '),
    }));
  }
  selected = new Set<string>(); bulkValue = ''; bulkPreviewItems: Array<{ productId: string; name?: string; oldValue?: string | null; newValue?: string }> = [];
  customerDialog = false; customerName = ''; customerPhone = ''; customerRegion = 'US'; customerRuleIndex = -1; customerError = ''; customerBusy = false;
  workbookValidation: WorkbookValidation | null = null; workbookChoices: WorkbookDecision[] = []; workbookBusy = false; showWorkbookLoader = false; showExportComplete = false; workbookType: Tab = 'selling';
  statusFilter: 'all'|'priced'|'unpriced' = 'all';
  importResult: Array<{rowNumber:number;productId?:string;success?:boolean;priceChanged?:boolean;code?:string;name?:string;price?:string}> = [];
  importRuleResult: Array<{rowNumber:number;productName?:string;customerName?:string;minimumQuantity?:number|null;sellingPrice?:string;success?:boolean;created?:boolean;ignored?:boolean;code?:string}> = [];
  showImportResult = false;
  floatingHeading = false;
  floatingTop = 0;
  mobileSearchOpen = false;
  mobileSearchTop = 0;
  filtersOpen = false;
  floatingLeft = 0;
  floatingWidth = 0;
  floatingBarHeight = 0;
  toolbarHeight = 0;
  private scrollContainer: HTMLElement | null = null;
  private floatingBarObserver: ResizeObserver | null = null;
  private toolbarObserver: ResizeObserver | null = null;
  private readonly updateFloatingHeading = (): void => {
    const title = document.getElementById('pricing-title');
    const dashboardHeader = document.querySelector('app-dashboard-header');
    if (!title || !dashboardHeader || !this.scrollContainer) return;
    const floatingBar = document.querySelector<HTMLElement>('.pricing__floating-bar');
    const wasFloating = this.floatingHeading;
    const headerRect = dashboardHeader.getBoundingClientRect();
    const headerBottom = headerRect.bottom;
    this.floatingLeft = headerRect.left;
    this.floatingWidth = headerRect.width;
    this.floatingTop = headerBottom;
    this.floatingBarHeight = floatingBar?.getBoundingClientRect().height || 0;
    this.floatingHeading = title.getBoundingClientRect().top <= headerBottom + 1;
    if (!this.floatingHeading) this.mobileSearchOpen = false;
    if (this.floatingHeading && !wasFloating) window.requestAnimationFrame(this.updateFloatingHeading);
  };
  readonly countries = COUNTRY_CODES;
  private readonly searchChanges = new Subject<string>();
  get callingCode(): string { return this.countries.find(x => x.region === this.customerRegion)?.code || '+1'; }
  get activeRuleCount(): number { return this.rows.reduce((sum, row) => sum + row.rules.filter(rule => rule.active).length, 0); }
  get separateTaxCount(): number { return this.rows.filter(row => !row.taxInclusive && (row.separateTaxAmount || row.separateTaxId)).length; }
  get visibleRows(): PricedProduct[] { return this.rows.filter(row => {
    if (this.tab === 'selling' && this.selectedCustomerId && !this.customerRules(row).length) return false;
    const service = ['Service', 'Services'].includes(row.type);
    const priced = this.tab === 'purchase'
      ? row.variantPrices.some(price => price.purchaseCost != null) || (!service && row.purchaseCost != null)
      : row.variantPrices.some(price => price.sellingPrice != null) || (!service && (row.defaultSellingPrice != null || Boolean(this.selectedCustomerId && this.customerRules(row).length)));
    return this.statusFilter === 'all' || (this.statusFilter === 'priced') === priced;
  }); }
  get workbookChoicesReady(): boolean { return Boolean(this.workbookValidation?.canCommit) && this.workbookValidation!.products.filter(p => !p.productId).every(p => { const choice = this.decision(p.rowNumber); return choice.confirmed === true && (choice.action !== 'update' || Boolean(choice.productId)) && (choice.action !== 'create' || !p.similarMatches.length || choice.confirmDuplicate === true); }); }
  get allVisibleSelected(): boolean { return this.visibleRows.length > 0 && this.visibleRows.every(row => this.selected.has(row.id)); }
  get filteredCategories(): PricingCategory[] { const query = this.categoryQuery.trim().toLocaleLowerCase(); return this.categories.filter(item => !query || item.name.toLocaleLowerCase().includes(query)); }
  constructor(private readonly route: ActivatedRoute, private readonly api: PricingApiService, private readonly people: BusinessAdminService, private readonly auth: AuthService) {}
  ngOnInit(): void {
    let cursor: ActivatedRoute | null = this.route; while (cursor && !this.businessId) { this.businessId = cursor.snapshot.paramMap.get('businessId') || ''; cursor = cursor.parent; }
    const callingCode = parsePhoneE164(this.auth.currentUser()?.phoneE164)?.countryCallingCode || '+1'; this.customerRegion = this.countries.find(x => x.code === callingCode)?.region || 'US';
    this.searchChanges.pipe(debounceTime(250), distinctUntilChanged()).subscribe(() => this.load(true)); this.load();
  }
  ngAfterViewInit(): void {
    this.scrollContainer = document.querySelector<HTMLElement>('.workspace-content');
    const floatingBar = document.querySelector<HTMLElement>('.pricing__floating-bar');
    const toolbar = document.querySelector<HTMLElement>('.pricing__toolbar');
    if (floatingBar) {
      this.floatingBarObserver = new ResizeObserver(() => {
        const height = floatingBar.getBoundingClientRect().height;
        if (height !== this.floatingBarHeight) this.floatingBarHeight = height;
      });
      this.floatingBarObserver.observe(floatingBar);
    }
    if (toolbar) {
      this.toolbarObserver = new ResizeObserver(() => {
        const height = toolbar.getBoundingClientRect().height;
        if (height !== this.toolbarHeight) this.toolbarHeight = height;
      });
      this.toolbarObserver.observe(toolbar);
    }
    this.scrollContainer?.addEventListener('scroll', this.updateFloatingHeading, { passive: true });
    window.addEventListener('resize', this.updateFloatingHeading, { passive: true });
    this.updateFloatingHeading();
  }
  ngOnDestroy(): void {
    this.scrollContainer?.removeEventListener('scroll', this.updateFloatingHeading);
    this.floatingBarObserver?.disconnect();
    this.toolbarObserver?.disconnect();
    window.removeEventListener('resize', this.updateFloatingHeading);
    this.searchChanges.complete();
  }
  closeFloatingPopups(): void { this.mobileSearchOpen = false; this.filtersOpen = false; }
  toggleMobileSearch(event: MouseEvent): void {
    this.mobileSearchOpen = !this.mobileSearchOpen;
    if (this.mobileSearchOpen) this.mobileSearchTop = (event.currentTarget as HTMLElement).getBoundingClientRect().bottom + 6;
  }
  @HostListener('document:keydown.escape') closeFloatingPopupsOnEscape(): void { this.closeFloatingPopups(); }
  @HostListener('document:click', ['$event']) closePopupsOnOutsideClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.pricing-category-combo')) this.categoryOpen = false;
    if (!target?.closest('.pricing__search-menu, .pricing__mobile-search-action')) this.mobileSearchOpen = false;
  }
  load(preserveView = false): void {
    const scrollTop = preserveView ? this.scrollContainer?.scrollTop : undefined;
    if (!preserveView) this.loading = true;
    this.errorKey = '';
    this.api.list(this.businessId, this.search, this.categoryId, this.page).subscribe({
      next: result => {
        this.rows = result.items; this.categories = result.categories; this.customers = result.customers || [];
        if (!this.customers.some(customer => customer.id === this.selectedCustomerId)) this.selectedCustomerId = '';
        this.page = result.page; this.hasNextPage = result.hasNextPage;
        this.canView = result.authorization.isOwner || result.authorization.permissionKeys.includes('business.pricing.view');
        this.canManage = result.authorization.isOwner || result.authorization.permissionKeys.includes('business.pricing.manage');
        this.canImport = result.authorization.isOwner || result.authorization.permissionKeys.includes('business.pricing.import');
        this.canExport = result.authorization.isOwner || result.authorization.permissionKeys.includes('business.pricing.export');
        this.loading = false;
        if (scrollTop !== undefined) window.requestAnimationFrame(() => {
          if (this.scrollContainer && this.scrollContainer.scrollTop !== scrollTop) this.scrollContainer.scrollTop = scrollTop;
          this.updateFloatingHeading();
        });
      },
      error: (error: HttpErrorResponse) => { this.errorKey = error.status === 403 ? 'f012.forbidden' : 'f012.loadError'; this.loading = false; }
    });
  }
  searchChanged(): void { this.page = 1; this.searchChanges.next(this.search); }
  filterChanged(): void { this.page = 1; this.load(); }
  changePage(delta: number): void { const next = this.page + delta; if (next < 1 || (delta > 0 && !this.hasNextPage)) return; this.page = next; this.load(); }
  setTab(tab: Tab): void { this.tab = tab; this.editor = null; this.errorKey = ''; this.noticeKey = ''; }
  categoryName(id: string): string { return this.categories.find(x => x.id === id)?.name || ''; }
  openCategoryPicker(): void { this.categoryOpen = true; this.categoryQuery = ''; }
  searchCategories(value: string): void { this.categoryQuery = value; this.categoryOpen = true; }
  chooseCategory(category: PricingCategory | null): void { this.categoryId = category?.id || ''; this.categoryQuery = category?.name || ''; this.categoryOpen = false; this.filterChanged(); }
  categoryLabels(row: PricedProduct): string { return row.categoryIds.map(id => this.categoryName(id)).filter(Boolean).join(', '); }
  selectCustomer(customerId: string): void { this.selectedCustomerId = String(customerId || ''); }
  customerRules(row: PricedProduct): PricingRule[] { const customerId = String(this.selectedCustomerId || ''); return customerId ? row.rules.filter(rule => rule.active && String(rule.customerUserId || '') === customerId) : []; }
  displayedRules(row: PricedProduct): PricingRule[] { return this.selectedCustomerId ? this.customerRules(row) : row.rules; }
  toggle(id: string, checked: boolean): void { if (checked) this.selected.add(id); else this.selected.delete(id); this.selected = new Set(this.selected); }
  selectVisible(checked: boolean): void { this.selected = new Set(checked ? this.visibleRows.map(x => x.id) : []); }
  openPurchase(row: PricedProduct): void { this.editVariantPrices(row); this.current = row; this.purchaseCost = row.purchaseCost || ''; this.taxInclusive = row.taxInclusive; this.separateTaxAmount = row.separateTaxAmount || ''; this.separateTaxId = row.separateTaxId || ''; this.editor = 'purchase'; this.errorKey = ''; }
  openSelling(row: PricedProduct): void { this.editVariantPrices(row); this.current = row; this.defaultSellingPrice = row.defaultSellingPrice || ''; this.rules = row.rules.map(rule => ({ ...rule, audience: rule.customerUserId ? 'user' : 'everyone' })); this.editor = 'selling'; this.errorKey = ''; }
  addRule(): void { this.rules = [...this.rules, { customerUserId: null, audience: 'everyone', minimumQuantity: null, sellingPrice: '', active: true }]; }
  setRuleAudience(index: number, audience: 'everyone' | 'user'): void { this.rules = this.rules.map((rule, i) => i === index ? { ...rule, audience, ...(audience === 'everyone' ? { customerUserId: null, customerName: undefined } : {}) } : rule); this.errorKey = ''; }
  removeRule(index: number): void { this.rules = this.rules.filter((_, i) => i !== index); }
  openCustomer(index: number): void { this.customerRuleIndex = index; this.customerName = ''; this.customerPhone = ''; this.customerError = ''; this.customerDialog = true; }
  resolveCustomer(): void {
    if (this.customerBusy || !this.customerPhone.trim()) return;
    this.customerBusy = true; this.customerError = '';
    this.api.lookupCustomer(this.businessId, { countryCallingCode: this.callingCode, phoneNumber: this.customerPhone }).subscribe({
      next: result => {
        if (result.exists && result.userId) { this.assignCustomer(result.userId, result.name || ''); return; }
        const name = this.customerName.trim();
        if (!name) { this.customerBusy = false; this.customerError = 'f012.customerNameRequired'; return; }
        this.people.addPerson(this.businessId, { countryCallingCode: this.callingCode, phoneNumber: this.customerPhone, name }).subscribe({ next: added => this.assignCustomer(added.person.userId, added.person.name), error: e => { this.customerBusy = false; this.customerError = e.status === 403 ? 'f012.customerAddForbidden' : 'f012.customerAddError'; } });
      }, error: e => { this.customerBusy = false; this.customerError = e.status === 403 ? 'f012.customerAddForbidden' : 'f012.customerLookupError'; },
    });
  }
  private assignCustomer(userId: string, name: string): void { const next = this.rules.map((rule, index) => index === this.customerRuleIndex ? { ...rule, customerUserId: userId, customerName: name, audience: 'user' as const } : rule); this.rules = next; this.customerBusy = false; this.customerDialog = false; }
  closeEditor(): void { if (!this.saving) this.editor = null; }
  saveEditor(): void {
    if (!this.current || this.saving) return;
    if (this.editor === 'selling' && this.rules.some(rule => rule.audience === 'user' && !rule.customerUserId)) { this.errorKey = 'f012.userRequired'; return; }
    const payload = this.editor === 'purchase' ? { purchaseCost: this.purchaseCost || null, taxInclusive: this.taxInclusive, separateTaxAmount: this.taxInclusive ? null : this.separateTaxAmount || null, separateTaxId: this.taxInclusive ? null : this.separateTaxId || null, version: this.current.version }
      : { defaultSellingPrice: this.defaultSellingPrice || null, rules: this.rules.map(({ audience, ...rule }) => rule), version: this.current.version };
    const variantPrices = this.variantPrices.filter(price => price.sellingPrice || price.purchaseCost).map(({ label, ...price }) => price);
    this.saving = true; this.errorKey = ''; this.api.save(this.businessId, this.current.id, { ...payload, variantPrices }).subscribe({ next: () => { this.saving = false; this.editor = null; this.noticeKey = 'f012.saved'; this.load(); }, error: e => { this.saving = false; this.errorKey = e.status === 409 ? 'f012.stale' : e.error?.error?.code === 'SEPARATE_TAX_REQUIRED' ? 'f012.separateTaxRequired' : 'f012.saveError'; } });
  }
  previewBulk(): void { if (!this.selected.size || !this.bulkValue.trim()) return; this.api.bulk(this.businessId, [...this.selected], this.tab === 'purchase' ? { purchaseCost: this.bulkValue } : { defaultSellingPrice: this.bulkValue }, true).subscribe({ next: r => this.bulkPreviewItems = r.items, error: () => this.errorKey = 'f012.bulkError' }); }
  applyBulk(): void { if (!this.bulkPreviewItems.length) return; this.saving = true; this.api.bulk(this.businessId, [...this.selected], this.tab === 'purchase' ? { purchaseCost: this.bulkValue } : { defaultSellingPrice: this.bulkValue }).subscribe({ next: r => { this.saving = false; this.bulkPreviewItems = []; this.selected.clear(); this.noticeKey = r.failed ? 'f012.bulkPartial' : 'f012.saved'; this.load(); }, error: () => { this.saving = false; this.errorKey = 'f012.bulkError'; } }); }
  exportPrices(): void { if (!this.canExport || this.workbookBusy) return; this.workbookBusy = true; this.showWorkbookLoader = true; this.showExportComplete = false; this.api.exportWorkbook(this.businessId, this.tab, [...this.selected]).subscribe({ next: job => this.pollWorkbookJob<never>(job.jobId, result => { if (result.status === 'failed') { this.workbookBusy = false; this.showWorkbookLoader = false; this.errorKey = 'f012.exportError'; return; } this.api.downloadWorkbookJob(this.businessId, job.jobId).subscribe({ next: blob => { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${this.tab}-pricing.xlsx`; anchor.click(); URL.revokeObjectURL(url); this.workbookBusy = false; this.showWorkbookLoader = false; this.showExportComplete = true; }, error: () => { this.workbookBusy = false; this.showWorkbookLoader = false; this.errorKey = 'f012.exportError'; } }); }, 'export'), error: () => { this.workbookBusy = false; this.showWorkbookLoader = false; this.errorKey = 'f012.exportError'; } }); }
  chooseWorkbook(event: Event): void { const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file || !this.canImport) return; this.workbookType = this.tab; this.workbookBusy = true; this.showWorkbookLoader = true; this.workbookValidation = null; this.workbookChoices = []; this.api.validateWorkbook(this.businessId, this.tab, file).subscribe({ next: job => this.pollWorkbookJob<WorkbookValidation>(job.jobId, result => { this.workbookBusy = false; this.showWorkbookLoader = false; if (result.status === 'failed' || !result.result) { this.errorKey = 'f012.importError'; return; } const validation = result.result; this.workbookValidation = validation; this.workbookChoices = validation.products.filter(p => !p.productId).map(p => ({ rowNumber: p.rowNumber, action: p.similarMatches.length ? 'ignore' : 'create', confirmed: !p.similarMatches.length, confirmDuplicate: false })); }, 'validate'), error: e => { this.workbookBusy = false; this.showWorkbookLoader = false; this.errorKey = e.error?.error?.code === 'WORKBOOK_TOO_LARGE' ? 'f012.workbookTooLarge' : 'f012.importError'; } }); }
  decision(rowNumber: number): WorkbookDecision { return this.workbookChoices.find(x => x.rowNumber === rowNumber) || { rowNumber, action: 'ignore' }; }
  updateDecision(rowNumber: number, action: 'create'|'ignore'|'update'): void { const existing = this.decision(rowNumber); this.workbookChoices = [...this.workbookChoices.filter(x => x.rowNumber !== rowNumber), { ...existing, action, confirmed: true, ...(action !== 'update' ? { productId: undefined } : {}) }]; }
  chooseUpdate(rowNumber: number, productId: string): void { this.workbookChoices = [...this.workbookChoices.filter(x => x.rowNumber !== rowNumber), { ...this.decision(rowNumber), action: 'update', productId, confirmed: true }]; }
  confirmDuplicate(rowNumber: number, checked: boolean): void { this.workbookChoices = [...this.workbookChoices.filter(x => x.rowNumber !== rowNumber), { ...this.decision(rowNumber), confirmDuplicate: checked, confirmed: true }]; }
  commitImport(): void { if (!this.workbookValidation?.canCommit || this.workbookBusy) return; this.workbookBusy = true; this.showWorkbookLoader = true; this.api.commitWorkbook(this.businessId, this.workbookType, this.workbookValidation.operationId, this.workbookValidation.digest, this.workbookChoices).subscribe({ next: job => this.pollWorkbookJob<{ committed: boolean; results: Array<{rowNumber:number;productId?:string;name?:string;price?:string;success?:boolean;priceChanged?:boolean;ignored?:boolean;code?:string}>; ruleResults?: Array<{rowNumber:number;productName?:string;customerName?:string;minimumQuantity?:number|null;sellingPrice?:string;success?:boolean;created?:boolean;ignored?:boolean;code?:string}> }>(job.jobId, result => { this.workbookBusy = false; this.showWorkbookLoader = false; if (result.status === 'failed' || !result.result) { this.errorKey = 'f012.importError'; return; } if (!result.result.committed) { this.errorKey = 'f012.productChoiceRequired'; return; } this.importResult = result.result.results; this.importRuleResult = result.result.ruleResults || []; this.workbookValidation = null; this.showImportResult = false; this.load(); setTimeout(() => this.showImportResult = true, 0); }, 'commit'), error: e => { this.workbookBusy = false; this.showWorkbookLoader = false; this.errorKey = e.status === 409 ? 'f012.stale' : 'f012.importError'; } }); }
  private pollWorkbookJob<T>(jobId: string, done: (job: import('./pricing.models').WorkbookJob<T>) => void, label: string): void { this.api.workbookJob<T>(this.businessId, jobId).subscribe({ next: job => { if (job.status === 'failed') { done(job); return; } if (job.status === 'completed') { if (!job.resultUrl) { done(job); return; } this.api.workbookJobResult<T>(this.businessId, jobId).subscribe({ next: result => done({ ...job, result }), error: () => { this.workbookBusy = false; this.showWorkbookLoader = false; this.errorKey = label === 'export' ? 'f012.exportError' : 'f012.importError'; } }); return; } window.setTimeout(() => this.pollWorkbookJob(jobId, done, label), 900); }, error: () => { this.workbookBusy = false; this.showWorkbookLoader = false; this.errorKey = label === 'export' ? 'f012.exportError' : 'f012.importError'; } }); }
  closeImportReview(): void { this.workbookValidation = null; }
  closeImportResult(): void { this.showImportResult = false; }
  dismissWorkbookLoader(): void { this.showWorkbookLoader = false; }
  closeExportComplete(): void { this.showExportComplete = false; }
  get successfulImports(): typeof this.importResult { return this.importResult.filter(x => x.priceChanged && x.success); }
  get failedImports(): typeof this.importResult { return this.importResult.filter(x => x.priceChanged && x.success === false); }
  get successfulRuleImports(): typeof this.importRuleResult { return this.importRuleResult.filter(x => x.success); }
  get failedRuleImports(): typeof this.importRuleResult { return this.importRuleResult.filter(x => x.success === false); }
  get ignoredRuleImports(): typeof this.importRuleResult { return this.importRuleResult.filter(x => x.ignored); }
  formatTimestamp(value: string | null): string { return value ? new Date(value).toLocaleDateString() : '—'; }
}
