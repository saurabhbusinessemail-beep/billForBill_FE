import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SafeUrl } from '@angular/platform-browser';
import { Observable, Subscription, forkJoin, take } from 'rxjs';
import { prepareProductImage } from '../../dashboard/logo-image-processor';
import { CatalogApiService } from './catalog-api.service';
import { CatalogKind, CatalogRecord } from './catalog.models';
import { BusinessAdminService } from '../../people/business-admin.service';
import { AuthService } from '../../../core/auth/auth.service';
import { OpenFoodFactsSyncResult } from './catalog.models';

interface Draft {
  name: string; code: string; gtin: string; brand: string; description: string; type: string; symbol: string; dimension: string; parentId: string;
  offCountryTag: string; offCategoryTags: string; offIsActive: boolean;
  productIds: string[]; taxComponentIds: string[]; categoryIds: string[]; unitIds: string[]; attributeIds: string[];
  baseUnitId: string; additionalUnits: Array<{ unitId: string; conversionFactor: number }>;
  taxMode: 'inherit' | 'specific'; calculationType: 'percentage' | 'fixed'; value: number; currency: string;
  effectiveStart: string; effectiveEnd: string; jurisdiction: string;
}
const draft = (): Draft => ({ name: '', code: '', gtin: '', brand: '', description: '', type: 'Physical', symbol: '', dimension: 'other', parentId: '', offCountryTag: 'India', offCategoryTags: '', offIsActive: false, productIds: [], taxComponentIds: [], categoryIds: [], unitIds: [], attributeIds: [], baseUnitId: '', additionalUnits: [], taxMode: 'inherit', calculationType: 'percentage', value: 0, currency: 'INR', effectiveStart: new Date().toISOString().slice(0, 10), effectiveEnd: '', jurisdiction: '' });
const I18N: Record<CatalogKind, string> = { 'business-types': 'f008.businessTypes', products: 'f008.products', categories: 'f008.categories', attributes: 'f008.attributes', units: 'f008.units', taxes: 'f008.taxes' };
const englishOffTag = (value: string): string => { const slug = value.trim().toLowerCase().replace(/^en:/, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); return slug ? `en:${slug}` : ''; };

@Component({ selector: 'app-catalog-page', standalone: false, templateUrl: './catalog-page.component.html', styleUrl: './catalog-page.component.scss' })
export class CatalogPageComponent implements OnInit, AfterViewInit, OnDestroy {
  kind: CatalogKind = 'business-types';
  businessId = '';
  canManage = true;
  records: CatalogRecord[] = []; products: CatalogRecord[] = []; categories: CatalogRecord[] = []; attributes: CatalogRecord[] = []; units: CatalogRecord[] = []; taxes: CatalogRecord[] = [];
  isLoading = true; isSaving = false; isProcessingImage = false; errorKey = ''; noticeKey = ''; query = '';
  offSyncing = false; offSyncResult: OpenFoodFactsSyncResult | null = null; offSyncLimit = 10; offSyncRepetitions = 1; offTotalFetched = 0; offRepetitionsLeft = 0; offSyncStarted = false; offSyncErrorMessage = ''; offSyncTab: 'products' | 'categories' | 'units' | 'attributes' = 'products'; private offSyncTargetRepetitions = 0; private offSyncRequest?: Subscription; private offSyncRunId = 0;
  offSuggestions: Array<{ tag: string; name: string }> = []; selectedOffSuggestionTags = new Set<string>(); offSuggestionsLoading = false; private offSuggestionRequest?: Subscription;
  editorOpen = false; editing: CatalogRecord | null = null; value = draft(); image: File | null = null; imagePreview = ''; imageError = '';
  inlineKind: CatalogKind | null = null; inline = draft(); inlineImage: File | null = null; inlinePreview = ''; inlineError = '';
  deleteTarget: CatalogRecord | null = null; deleteImpact: Array<{ label: string; count: number; action: string }> = []; businessCopyCount = 0; deleteImpactLoading = false; expanded = new Set<string>(); private request?: Subscription; private authorizationRequest?: Subscription; private routeRequest?: Subscription; private queryTimer?: ReturnType<typeof setTimeout>;
  floatingHeading = false; floatingTop = 0; floatingLeft = 0; floatingWidth = 0; floatingSearchOpen = false; floatingSearchTop = 0;
  private scrollContainer: HTMLElement | null = null;
  private floatingBarObserver: ResizeObserver | null = null;
  private readonly updateFloatingHeading = (): void => {
    const title = document.getElementById('catalog-title');
    const dashboardHeader = document.querySelector<HTMLElement>('app-dashboard-header');
    if (!title || !dashboardHeader || !this.scrollContainer) return;
    const headerRect = dashboardHeader.getBoundingClientRect();
    this.floatingTop = headerRect.bottom;
    this.floatingLeft = headerRect.left;
    this.floatingWidth = headerRect.width;
    const wasFloating = this.floatingHeading;
    this.floatingHeading = title.getBoundingClientRect().top <= headerRect.bottom + 1 || this.floatingSearchOpen;
    if (!this.floatingHeading) this.floatingSearchOpen = false;
    if (this.floatingHeading && !wasFloating) window.requestAnimationFrame(this.updateFloatingHeading);
  };
  constructor(readonly api: CatalogApiService, private readonly route: ActivatedRoute, private readonly businessAdmin: BusinessAdminService, readonly auth: AuthService) {}
  get isSuperAdmin(): boolean { return this.auth.currentUser()?.isSuperAdmin === true; }
  get hasOffSuggestionQuery(): boolean { return this.value.offCategoryTags.split(/[\n,]+/).some(term => term.trim().length >= 2); }
  get offMappingComplete(): boolean { return Boolean(englishOffTag(this.value.offCountryTag) && this.value.offCategoryTags.split(/[\n,]+/).some(term => englishOffTag(term))); }
  get offSyncLimitsValid(): boolean { return Number.isSafeInteger(Number(this.offSyncLimit)) && Number(this.offSyncLimit) > 0 && Number.isSafeInteger(Number(this.offSyncRepetitions)) && Number(this.offSyncRepetitions) > 0; }
  get selectedOffSuggestions(): Array<{ tag: string; name: string }> { return this.offSuggestions.filter(item => this.selectedOffSuggestionTags.has(item.tag)); }
  get offSyncProductAdditions(): OpenFoodFactsSyncResult['results'] { return (this.offSyncResult?.results || []).filter(item => item.status === 'inserted' || item.status === 'would_insert'); }
  get allOffSuggestionsSelected(): boolean { return this.offSuggestions.length > 0 && this.offSuggestions.every(item => this.selectedOffSuggestionTags.has(item.tag)); }
  get offMappingDirty(): boolean { const saved = this.editing?.openFoodFactsConfig; const tags = [...new Set(this.value.offCategoryTags.split(/[\n,]/).map(englishOffTag).filter(Boolean))]; return Boolean(this.editing && (englishOffTag(this.value.offCountryTag) !== (saved?.countryTag || '') || this.value.offIsActive !== (saved?.isActive === true) || tags.join('|') !== (saved?.categoryTags || []).join('|'))); }
  ngOnInit(): void {
    this.routeRequest = this.route.paramMap.subscribe(params => {
      const nextKind = (this.route.snapshot.data['kind'] as CatalogKind) || (params.get('kind') as CatalogKind) || 'business-types';
      const nextBusinessId = params.get('businessId') || this.route.parent?.snapshot.paramMap.get('businessId') || '';
      if (this.kind === nextKind && this.businessId === nextBusinessId && this.records.length) return;
      this.kind = nextKind;
      this.businessId = nextBusinessId;
      this.records = []; this.products = []; this.categories = []; this.attributes = []; this.units = []; this.taxes = [];
      this.stopOffSyncLoop(); this.resetOffSync(); this.editorOpen = false; this.editing = null; this.deleteTarget = null; this.expanded.clear(); this.noticeKey = ''; this.query = '';
      this.authorizationRequest?.unsubscribe();
      this.canManage = !this.businessId;
      if (this.businessId) this.authorizationRequest = this.businessAdmin.catalogAuthorization(this.businessId).subscribe({ next: x => this.canManage = Boolean(x.isOwner || x.permissionKeys.includes(`business.catalog.${this.kind}.manage`)), error: () => this.canManage = false });
      this.load();
      window.requestAnimationFrame(this.updateFloatingHeading);
    });
  }
  ngAfterViewInit(): void {
    this.scrollContainer = document.querySelector<HTMLElement>('.workspace-content');
    const floatingBar = document.querySelector<HTMLElement>('.catalog-page__floating-bar');
    if (floatingBar) {
      this.floatingBarObserver = new ResizeObserver(() => this.updateFloatingHeading());
      this.floatingBarObserver.observe(floatingBar);
    }
    this.scrollContainer?.addEventListener('scroll', this.updateFloatingHeading, { passive: true });
    window.addEventListener('resize', this.updateFloatingHeading, { passive: true });
    this.updateFloatingHeading();
  }
  ngOnDestroy(): void { this.stopOffSyncLoop(); this.scrollContainer?.removeEventListener('scroll', this.updateFloatingHeading); this.floatingBarObserver?.disconnect(); window.removeEventListener('resize', this.updateFloatingHeading); this.request?.unsubscribe(); this.authorizationRequest?.unsubscribe(); this.routeRequest?.unsubscribe(); this.offSuggestionRequest?.unsubscribe(); clearTimeout(this.queryTimer); this.revoke(this.imagePreview); this.revoke(this.inlinePreview); }
  get titleKey(): string { return I18N[this.kind]; }
  get businessTypeInUse(): boolean { return this.kind === 'business-types' && this.deleteImpact.some(item => item.label === 'businesses'); }
  load(preserveContent = false): void {
    if (!preserveContent) this.isLoading = true; this.errorKey = ''; this.request?.unsubscribe();
    this.request = forkJoin({ records: this.api.list(this.kind, this.query, this.businessId || undefined), products: this.api.list('products', '', this.businessId || undefined), categories: this.api.list('categories', '', this.businessId || undefined), attributes: this.api.list('attributes', '', this.businessId || undefined), units: this.api.list('units', '', this.businessId || undefined), taxes: this.api.list('taxes', '', this.businessId || undefined) }).subscribe({
      next: data => { this.records = data.records; this.products = data.products; this.categories = data.categories; this.attributes = data.attributes; this.units = data.units; this.taxes = data.taxes; this.isLoading = false; },
      error: (e: HttpErrorResponse) => { this.errorKey = e.status === 401 ? 'f008.sessionExpired' : e.status === 403 ? 'f007.permissionDenied' : 'f008.loadError'; this.isLoading = false; },
    });
  }
  search(): void { clearTimeout(this.queryTimer); this.queryTimer = setTimeout(() => this.load(true), 250); }
  toggleFloatingSearch(event: MouseEvent): void { this.floatingSearchOpen = !this.floatingSearchOpen; if (this.floatingSearchOpen) this.floatingSearchTop = (event.currentTarget as HTMLElement).getBoundingClientRect().bottom + 6; else window.requestAnimationFrame(this.updateFloatingHeading); }
  @HostListener('document:keydown.escape') closeFloatingSearchOnEscape(): void { this.floatingSearchOpen = false; window.requestAnimationFrame(this.updateFloatingHeading); }
  @HostListener('document:click', ['$event']) closeFloatingSearchOnOutsideClick(event: MouseEvent): void { const target = event.target as HTMLElement | null; if (!target?.closest('.catalog-page__floating-search-menu, .catalog-page__floating-search-action') && this.floatingSearchOpen) { this.floatingSearchOpen = false; window.requestAnimationFrame(this.updateFloatingHeading); } }
  add(): void { this.resetOffSync(); this.editing = null; this.clearOffSuggestions(); this.value = draft(); this.image = null; this.imageError = ''; this.preview(''); this.editorOpen = true; }
  edit(record: CatalogRecord): void {
    this.resetOffSync(); this.editing = record; const off = record.openFoodFactsConfig || {}; this.clearOffSuggestions(); this.value = { ...draft(), ...record, offCountryTag: String(off.countryTag || 'en:india').replace(/^en:/i, '').replace(/-/g, ' '), offCategoryTags: (off.categoryTags || []).map(tag => tag.replace(/^en:/i, '').replace(/-/g, ' ')).join('\n'), offIsActive: off.isActive === true, parentId: record.parentId || '', baseUnitId: record.baseUnitId || '', productIds: record.productIds || [], taxComponentIds: record.taxComponentIds || [], categoryIds: record.categoryIds || [], unitIds: record.unitIds || [], attributeIds: record.attributeIds || [], additionalUnits: record.additionalUnits || [], effectiveStart: record.effectiveStart?.slice(0, 10) || draft().effectiveStart, effectiveEnd: record.effectiveEnd?.slice(0, 10) || '', calculationType: record.calculationType || 'percentage', taxMode: record.taxMode || 'inherit' };
    this.image = null; this.imageError = ''; this.preview(''); this.editorOpen = true;
  }
  clearOffSuggestions(): void { this.offSuggestionRequest?.unsubscribe(); this.offSuggestions = []; this.selectedOffSuggestionTags.clear(); this.offSuggestionsLoading = false; }
  searchOffCategorySuggestions(): void {
    const terms = this.value.offCategoryTags.split(/[\n,]+/).map(term => term.trim()).filter(Boolean);
    if (!terms.length || !terms.some(term => term.length >= 2)) return;
    this.offSuggestionRequest?.unsubscribe(); this.offSuggestions = []; this.selectedOffSuggestionTags.clear(); this.offSuggestionsLoading = true;
    this.offSuggestionRequest = this.api.openFoodFactsTaxonomy(terms.at(-1) || '', terms.slice(0, -1)).subscribe({ next: items => { this.offSuggestions = items; this.offSuggestionsLoading = false; }, error: e => { this.offSuggestions = []; this.offSuggestionsLoading = false; this.errorKey = this.errorFor(e); } });
  }
  isOffSuggestionSelected(tag: string): boolean { return this.selectedOffSuggestionTags.has(tag); }
  toggleOffSuggestion(tag: string, event: Event): void { if ((event.target as HTMLInputElement).checked) this.selectedOffSuggestionTags.add(tag); else this.selectedOffSuggestionTags.delete(tag); }
  toggleAllOffSuggestions(event: Event): void { if ((event.target as HTMLInputElement).checked) this.offSuggestions.forEach(item => this.selectedOffSuggestionTags.add(item.tag)); else this.selectedOffSuggestionTags.clear(); }
  addSelectedOffSuggestions(): void {
    if (!this.selectedOffSuggestionTags.size) return;
    const selected = new Set(this.selectedOffSuggestionTags);
    const existing = this.value.offCategoryTags.split(/[\n,]+/).map(term => term.trim()).filter(Boolean);
    const known = new Set(existing.map(englishOffTag));
    for (const item of this.selectedOffSuggestions) if (!known.has(item.tag)) { existing.push(item.name); known.add(item.tag); }
    this.value.offCategoryTags = existing.join('\n'); this.offSuggestions = this.offSuggestions.filter(item => !selected.has(item.tag)); this.selectedOffSuggestionTags.clear();
  }
  close(): void { if (this.isSaving || this.isProcessingImage) return; this.stopOffSyncLoop(); this.resetOffSync(); this.editorOpen = false; this.clearOffSuggestions(); this.image = null; this.preview(''); }
  toggle(field: 'productIds'|'taxComponentIds'|'categoryIds'|'unitIds'|'attributeIds', id: string, event: Event): void { const set = new Set(this.value[field]); if ((event.target as HTMLInputElement).checked) set.add(id); else set.delete(id); this.value = { ...this.value, [field]: [...set] }; }
  checked(field: 'productIds'|'taxComponentIds'|'categoryIds'|'unitIds'|'attributeIds', id: string): boolean { return this.value[field].includes(id); }
  unitLabel(id: string): string { const unit=this.units.find(item=>item.id===id); return unit ? `${unit.name} (${unit.symbol})` : ''; }
  isAdditionalUnit(id: string): boolean { return this.value.additionalUnits.some(item=>item.unitId===id); }
  conversionFactor(id:string):number{return this.value.additionalUnits.find(item=>item.unitId===id)?.conversionFactor||1;}
  toggleAdditionalUnit(id: string,event:Event): void { const selected=(event.target as HTMLInputElement).checked; const other=this.value.additionalUnits.filter(item=>item.unitId!==id); if(selected)other.push({unitId:id,conversionFactor:1}); this.value={...this.value,additionalUnits:other}; }
  setAdditionalConversion(id:string,event:Event):void { const factor=Number((event.target as HTMLInputElement).value); this.value={...this.value,additionalUnits:this.value.additionalUnits.map(item=>item.unitId===id?{...item,conversionFactor:factor}:item)}; }
  tree(): Array<{ item: CatalogRecord; depth: number }> { const out: Array<{ item: CatalogRecord; depth: number }> = []; const walk = (parent: string|null, depth: number): void => { for (const item of this.categories.filter(c => (c.parentId || null) === parent)) { out.push({ item, depth }); if (this.expanded.has(item.id)) walk(item.id, depth + 1); } }; walk(null, 0); return out; }
  hasChildren(id: string): boolean { return this.categories.some(item => item.parentId === id); }
  toggleTree(id: string): void { if (this.expanded.has(id)) this.expanded.delete(id); else this.expanded.add(id); }
  path(id: string): string { const item = this.categories.find(c => c.id === id); return !item ? '' : item.parentId ? `${this.path(item.parentId)} / ${item.name}` : item.name; }
  productType(type: string): string { return `f008.type.${type.toLowerCase()}`; }
  async chooseImage(event: Event, inline = false): Promise<void> { const input = event.target as HTMLInputElement; const file = input.files?.[0] || null; input.value = ''; await this.process(file, inline); }
  private async process(file: File|null, inline: boolean): Promise<void> {
    if (!file) return; const valid = ['image/jpeg','image/png','image/webp'].includes(file.type);
    if (!valid) { if (inline) this.inlineError = 'f008.imageInvalid'; else this.imageError = 'f008.imageInvalid'; return; }
    this.isProcessingImage = true;
    try { const prepared = await prepareProductImage(file); if (inline) { this.inlineImage = prepared; this.inlinePreview = URL.createObjectURL(prepared); } else { this.image = prepared; this.preview(URL.createObjectURL(prepared)); } }
    catch { if (inline) this.inlineError = 'f008.imageProcessingError'; else this.imageError = 'f008.imageProcessingError'; }
    finally { this.isProcessingImage = false; }
  }
  save(): void {
    if (this.isSaving || this.isProcessingImage || !this.value.name.trim()) return;
    if (this.kind === 'products' && !this.businessId && !this.image && (!this.editing || !this.editing.hasImage)) { this.imageError = 'f008.imageRequired'; return; }
    if (this.kind === 'products' && !this.value.baseUnitId) { this.errorKey = 'f008.unitRequired'; return; }
    const payload = this.payload(this.kind, this.value); this.isSaving = true; this.errorKey = '';
    const call = this.kind === 'products'
      ? this.businessId ? (this.editing ? this.api.update('products', this.editing.id, payload, this.businessId) : this.api.create('products', payload, this.businessId))
        : this.image ? this.api.saveProduct(payload, this.image, this.editing?.id) : this.api.update('products', this.editing!.id, payload)
      : this.editing ? this.api.update(this.kind, this.editing.id, payload, this.businessId || undefined) : this.api.create(this.kind, payload, this.businessId || undefined);
    call.subscribe({ next: record => {
      if (this.kind !== 'business-types') { this.finishSave(); return; }
      this.editing = record;
      const config = { countryTag: this.value.offCountryTag.trim(), categoryTags: this.value.offCategoryTags.split(/[\n,]/).map(tag => tag.trim()).filter(Boolean), isActive: this.value.offIsActive };
      this.api.saveOpenFoodFactsConfig(record.id, config).subscribe({ next: () => this.finishSave(), error: e => { this.isSaving = false; this.errorKey = this.errorFor(e); } });
    }, error: e => { this.isSaving = false; this.errorKey = this.errorFor(e); } });
  }
  private finishSave(): void { this.isSaving = false; this.stopOffSyncLoop(); this.resetOffSync(); this.editorOpen = false; this.noticeKey = 'f008.saved'; this.load(); }
  payload(kind: CatalogKind, d: Draft): Record<string, unknown> {
    if (kind === 'business-types') return { name:d.name,description:d.description,productIds:d.productIds,taxComponentIds:d.taxComponentIds };
    if (kind === 'products') return { name:d.name,gtin:d.gtin,brand:d.brand,type:d.type,description:d.description,categoryIds:d.categoryIds,baseUnitId:d.baseUnitId,additionalUnits:d.additionalUnits,attributeIds:d.attributeIds,taxMode:d.taxMode,taxComponentIds:d.taxMode==='specific'?d.taxComponentIds:[] };
    if (kind === 'categories') return { name:d.name,parentId:d.parentId||null,unitIds:d.unitIds };
    if (kind === 'attributes') return { name:d.name,unitIds:d.unitIds };
    if (kind === 'units') return { name:d.name,symbol:d.symbol,dimension:d.dimension };
    return { name:d.name,calculationType:d.calculationType,value:Number(d.value),currency:d.currency,effectiveStart:d.effectiveStart,effectiveEnd:d.effectiveEnd||null,jurisdiction:d.jurisdiction,description:d.description };
  }
  syncOpenFoodFacts(dryRun = false): void {
    if (!this.isSuperAdmin || !this.editing || this.offSyncing || !this.offSyncLimitsValid) return;
    this.offSyncRunId += 1; const runId = this.offSyncRunId;
    this.offSyncTargetRepetitions = Number(this.offSyncRepetitions); this.offSyncing = true; this.offSyncStarted = true; this.errorKey = ''; this.offSyncErrorMessage = ''; this.offSyncResult = null; this.offTotalFetched = 0; this.offRepetitionsLeft = this.offSyncTargetRepetitions; this.offSyncTab = 'products';
    this.runOffSyncRepetition(runId, dryRun, 0, 0);
  }
  private runOffSyncRepetition(runId: number, dryRun: boolean, completed: number, consecutiveFailures: number): void {
    if (runId !== this.offSyncRunId || !this.editorOpen || !this.editing || completed >= this.offSyncTargetRepetitions) return;
    this.offSyncRequest = this.api.syncOpenFoodFacts(this.editing.id, dryRun, Number(this.offSyncLimit), completed).pipe(take(1)).subscribe({
      next: result => {
        if (runId !== this.offSyncRunId || !this.editorOpen) return;
        this.mergeOffSyncResult(result); this.offTotalFetched = this.offSyncResult?.summary.scanned || 0; const successes = completed + 1; this.offRepetitionsLeft = Math.max(0, this.offSyncTargetRepetitions - successes);
        if (successes < this.offSyncTargetRepetitions) this.runOffSyncRepetition(runId, dryRun, successes, 0);
        else this.finishOffSync(runId, dryRun);
      },
      error: (e: HttpErrorResponse) => {
        if (runId !== this.offSyncRunId || !this.editorOpen) return;
        const exactMessage = String(e.error?.error?.message || e.message || 'Unknown error'); const failedAttempts = consecutiveFailures + 1;
        if (failedAttempts < 3) this.runOffSyncRepetition(runId, dryRun, completed, failedAttempts);
        else { this.offSyncErrorMessage = exactMessage; this.finishOffSync(runId, dryRun); }
      },
    });
  }
  private mergeOffSyncResult(next: OpenFoodFactsSyncResult): void {
    const previous = this.offSyncResult; const addition = next.catalogAdditions || next.plannedCatalogAdditions || { units: [], categories: [], attributes: [] };
    if (!previous) { this.offSyncResult = { ...next, catalogAdditions: addition }; return; }
    const priorAddition = previous.catalogAdditions || previous.plannedCatalogAdditions || { units: [], categories: [], attributes: [] };
    const unique = <T extends { name: string; parentName?: string | null }>(rows: T[], keyOf: (item: T) => string): T[] => [...new Map(rows.map(item => [keyOf(item), item])).values()];
    const catalogAdditions = {
      units: unique([...priorAddition.units, ...addition.units], item => item.name.toLowerCase()),
      categories: unique([...priorAddition.categories, ...addition.categories], item => `${item.parentName || ''}|${item.name}`.toLowerCase()),
      attributes: unique([...priorAddition.attributes, ...addition.attributes], item => item.name.toLowerCase()),
    };
    const summary = { scanned: previous.summary.scanned + next.summary.scanned, inserted: previous.summary.inserted + next.summary.inserted, matched: previous.summary.matched + next.summary.matched, skipped: previous.summary.skipped + next.summary.skipped, ambiguous: previous.summary.ambiguous + next.summary.ambiguous, failed: previous.summary.failed + next.summary.failed, newUnits: 0, newCategories: 0, newAttributes: 0 };
    summary.newUnits = catalogAdditions.units.length; summary.newCategories = catalogAdditions.categories.length; summary.newAttributes = catalogAdditions.attributes.length;
    this.offSyncResult = { ...next, status: previous.status === 'partial' || next.status === 'partial' ? 'partial' : next.status, summary, catalogAdditions, plannedCatalogAdditions: next.dryRun ? catalogAdditions : undefined, results: [...previous.results, ...next.results] };
  }
  private finishOffSync(runId: number, dryRun: boolean): void { if (runId !== this.offSyncRunId) return; this.offSyncing = false; this.offSyncRequest = undefined; if (!dryRun) this.load(true); }
  private stopOffSyncLoop(): void { this.offSyncRunId += 1; this.offSyncRequest?.unsubscribe(); this.offSyncRequest = undefined; this.offSyncing = false; }
  private resetOffSync(): void { this.stopOffSyncLoop(); this.offSyncResult = null; this.offSyncLimit = 10; this.offSyncRepetitions = 1; this.offSyncTargetRepetitions = 0; this.offTotalFetched = 0; this.offRepetitionsLeft = 0; this.offSyncStarted = false; this.offSyncErrorMessage = ''; this.offSyncTab = 'products'; }
  openInline(kind: CatalogKind): void { this.inlineKind = kind; this.inline = draft(); this.inlineImage = null; this.inlineError = ''; this.inlinePreview = ''; }
  closeInline(): void { this.inlineKind = null; this.revoke(this.inlinePreview); this.inlinePreview = ''; }
  saveInline(): void {
    if (!this.inlineKind || !this.inline.name.trim()) return; const kind = this.inlineKind; const body = this.payload(kind, this.inline);
    if (kind === 'products' && !this.businessId && !this.inlineImage) { this.inlineError = 'f008.imageRequired'; return; }
    if (kind === 'products' && !this.inline.baseUnitId) { this.inlineError = 'f008.unitRequired'; return; }
    this.isSaving = true; const call = kind === 'products' && !this.businessId ? this.api.saveProduct(body, this.inlineImage!) : this.api.create(kind, body, this.businessId || undefined);
    call.subscribe({ next: record => { this.isSaving = false; this.closeInline(); this.load(); this.selectInline(kind, record.id); }, error: e => { this.isSaving = false; this.inlineError = this.errorFor(e); } });
  }
  private selectInline(kind: CatalogKind, id: string): void {
    if (kind === 'products' && this.kind === 'business-types') this.value.productIds = [...this.value.productIds, id];
    if (kind === 'taxes' && (this.kind === 'business-types'||this.kind==='products')) this.value.taxComponentIds = [...this.value.taxComponentIds,id];
    if (kind === 'categories' && this.kind === 'products') this.value.categoryIds = [...this.value.categoryIds,id];
    if (kind === 'units' && this.kind === 'products' && !this.value.baseUnitId) this.value.baseUnitId=id;
    if (kind === 'units' && (this.kind === 'attributes'||this.kind==='categories')) this.value.unitIds=[...this.value.unitIds,id];
    if (kind === 'attributes' && this.kind === 'products') this.value.attributeIds=[...this.value.attributeIds,id];
  }
  inlinePayload(kind: CatalogKind): Record<string, unknown> { if(kind==='products')return {...this.payload(kind,this.inline),categoryIds:[],attributeIds:[],taxComponentIds:[],taxMode:'inherit'}; if(kind==='business-types')return {...this.payload(kind,this.inline),productIds:[],taxComponentIds:[]}; if(kind==='categories')return {...this.payload(kind,this.inline),unitIds:[]}; if(kind==='attributes')return {name:this.inline.name,unitIds:[]}; if(kind==='units')return this.payload(kind,this.inline); return this.payload(kind,this.inline); }
  askDelete(record: CatalogRecord): void { this.deleteTarget = record; this.deleteImpact = []; this.businessCopyCount = 0; this.deleteImpactLoading = true; this.api.deleteImpact(this.kind, record.id, this.businessId || undefined).subscribe({ next: result => { if (this.deleteTarget?.id === record.id) { this.deleteImpact = result.affected; this.businessCopyCount = result.businessCopyCount || 0; } this.deleteImpactLoading = false; }, error: () => { this.deleteImpactLoading = false; this.errorKey = 'f008.deleteImpactError'; this.deleteTarget = null; } }); }
  delete(scope?: 'admin-only' | 'all-copies'): void { const record=this.deleteTarget;if(!record)return;this.deleteTarget=null;this.api.delete(this.kind,record.id,this.businessId || undefined,scope).subscribe({next:()=>{this.noticeKey='f008.deleted';this.load();},error:(e:HttpErrorResponse)=>{this.errorKey=e.error?.error?.code==='BUSINESS_TYPE_IN_USE'?'f010.businessTypeInUse':e.error?.error?.code==='PRODUCT_COPIES_REQUIRE_CHOICE'?'f008.deleteImpactError':'f008.deleteError';} }); }
  imageUrl(record: CatalogRecord): Observable<SafeUrl> { return this.api.productImage(record.imageId || record.id, this.businessId || undefined); }
  categoryName(id: string): string { return this.path(id); }
  private errorFor(error: HttpErrorResponse): string { const code=error.error?.error?.code; const map:Record<string,string>={CATALOG_NAME_EXISTS:'f008.duplicate',PRODUCT_NAME_EXISTS:'f008.productDuplicate',PRODUCT_GTIN_EXISTS:'f025.gtinDuplicate',INVALID_GTIN:'f025.invalidGtin',PRODUCT_CODE_EXISTS:'f016.productCodeDuplicate',INVALID_PRODUCT_CODE:'f016.invalidProductCode',PRODUCT_UNIT_REQUIRED:'f008.unitRequired',PRODUCT_IMAGE_REQUIRED:'f008.imageRequired',PRODUCT_IMAGE_TOO_LARGE:'f008.imageTooLarge',INVALID_PRODUCT_IMAGE_CONTENT:'f008.imageInvalid',INVALID_REFERENCE:'f008.invalidReference',CATEGORY_CYCLE:'f008.categoryCycle',CURRENCY_REQUIRED:'f008.currencyRequired',INCOMPATIBLE_UNIT:'f008.incompatibleUnit',INVALID_OFF_COUNTRY:'f025.invalidCountry',INVALID_OFF_CATEGORIES:'f025.invalidCategories',OFF_CONFIG_REQUIRED:'f025.configRequired',OFF_CONFIG_DISABLED:'f025.configDisabled',OFF_COUNTRY_REQUIRED:'f025.countryRequired',OFF_CATEGORIES_REQUIRED:'f025.categoriesRequired',OFF_SYNC_IN_PROGRESS:'f025.syncBusy',OFF_UNAVAILABLE:'f025.upstreamError',OFF_UPSTREAM_UNAVAILABLE:'f025.upstreamUnavailable',OFF_UPSTREAM_ERROR:'f025.upstreamError',OFF_RATE_LIMITED:'f025.upstreamRateLimited',OFF_USER_AGENT_REQUIRED:'f025.userAgentRequired'};return map[code]||'f008.saveError'; }
  private preview(url:string):void{this.revoke(this.imagePreview);this.imagePreview=url;}
  private revoke(url:string):void{if(url.startsWith('blob:'))URL.revokeObjectURL(url);}
}
