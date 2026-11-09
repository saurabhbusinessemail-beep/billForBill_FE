import { ProductUnit } from './catalog.models';
import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SafeUrl } from '@angular/platform-browser';
import { Observable, Subscription, forkJoin, take } from 'rxjs';
import { prepareProductImage } from '../../dashboard/logo-image-processor';
import { BarcodeSuggestion, CatalogApiService } from './catalog-api.service';
import { CatalogKind, CatalogRecord } from './catalog.models';
import { BusinessAdminService } from '../../people/business-admin.service';

interface VariantDraft {
  barcode: string;
  gtin: string;
  mrp: string;
  key?: string;
  values: Record<string, string>;
  baseUnit: ProductUnit;
  additionalUnits: ProductUnit[];
}
const blankBaseUnit = (): ProductUnit => ({ key: 'base', name: '', symbol: '', dimension: 'count', factorToBase: '1', conversionKind: 'standard', active: true, source: 'manual' });
const blankVariant = (): VariantDraft => ({ values: {}, barcode: '', gtin: '', mrp: '', baseUnit: blankBaseUnit(), additionalUnits: [] });

interface Draft {
  title: string;
  brand: string;
  serviceMeasurement: NonNullable<CatalogRecord['serviceMeasurement']>;
  attributes: string[];
  variations: VariantDraft[];
  name: string; code: string; description: string; type: string; symbol: string; dimension: string; parentId: string;
  productIds: string[]; taxComponentIds: string[]; categoryIds: string[]; unitIds: string[];
  taxMode: 'inherit' | 'specific'; calculationType: 'percentage' | 'fixed'; value: number; currency: string;
  effectiveStart: string; effectiveEnd: string; jurisdiction: string;
}
const draft = (): Draft => ({ name: '', title: '', brand: '', serviceMeasurement: 'date_time', attributes: [], variations: [{ ...blankVariant(), key: 'default' }], code: '', description: '', type: 'Goods', symbol: '', dimension: 'other', parentId: '', productIds: [], taxComponentIds: [], categoryIds: [], unitIds: [], taxMode: 'inherit', calculationType: 'percentage', value: 0, currency: 'INR', effectiveStart: new Date().toISOString().slice(0, 10), effectiveEnd: '', jurisdiction: '' });
const I18N: Record<CatalogKind, string> = { 'business-types': 'f008.businessTypes', products: 'f008.products', categories: 'f008.categories', attributes: 'f008.attributes', units: 'f008.units', taxes: 'f008.taxes' };

@Component({ selector: 'app-catalog-page', standalone: false, templateUrl: './catalog-page.component.html', styleUrl: './catalog-page.component.scss' })
export class CatalogPageComponent implements OnInit, AfterViewInit, OnDestroy {
  kind: CatalogKind = 'business-types';
  businessId = '';
  canManage = true;
  readonly productDimensions = ['count', 'mass', 'volume', 'length', 'area', 'time', 'package', 'service', 'other'];
  records: CatalogRecord[] = []; products: CatalogRecord[] = []; categories: CatalogRecord[] = []; attributes: CatalogRecord[] = []; units: CatalogRecord[] = []; taxes: CatalogRecord[] = [];
  isLoading = true; isSaving = false; isProcessingImage = false; errorKey = ''; noticeKey = ''; query = '';
  editorOpen = false; editing: CatalogRecord | null = null; value = draft(); image: File | null = null; imagePreview = ''; imageError = '';
  attributeDraft = '';
  barcodeEntryOpen = false;
  barcodeVariant: VariantDraft | null = null;
  barcodeStatus = '';
  private barcodeRequest?: Subscription;
  private barcodeTimer?: ReturnType<typeof setTimeout>;
  barcodeImages: string[] = [];
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
  constructor(readonly api: CatalogApiService, private readonly route: ActivatedRoute, private readonly businessAdmin: BusinessAdminService) {}
  ngOnInit(): void {
    this.routeRequest = this.route.paramMap.subscribe(params => {
      const nextKind = (this.route.snapshot.data['kind'] as CatalogKind) || (params.get('kind') as CatalogKind) || 'business-types';
      const nextBusinessId = params.get('businessId') || this.route.parent?.snapshot.paramMap.get('businessId') || '';
      if (this.kind === nextKind && this.businessId === nextBusinessId && this.records.length) return;
      this.kind = nextKind;
      this.businessId = nextBusinessId;
      this.records = []; this.products = []; this.categories = []; this.attributes = []; this.units = []; this.taxes = [];
      this.editorOpen = false; this.barcodeEntryOpen = false; this.clearBarcodeLookup(); this.editing = null; this.deleteTarget = null; this.expanded.clear(); this.noticeKey = ''; this.query = '';
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
  ngOnDestroy(): void { this.clearBarcodeLookup(); this.scrollContainer?.removeEventListener('scroll', this.updateFloatingHeading); this.floatingBarObserver?.disconnect(); window.removeEventListener('resize', this.updateFloatingHeading); this.request?.unsubscribe(); this.authorizationRequest?.unsubscribe(); this.routeRequest?.unsubscribe(); clearTimeout(this.queryTimer); this.revoke(this.imagePreview); this.revoke(this.inlinePreview); }
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
  @HostListener('document:keydown.escape') closeFloatingSearchOnEscape(): void {
    if (this.barcodeEntryOpen) this.close();
    this.floatingSearchOpen = false;
    window.requestAnimationFrame(this.updateFloatingHeading);
  }
  @HostListener('document:click', ['$event']) closeFloatingSearchOnOutsideClick(event: MouseEvent): void { const target = event.target as HTMLElement | null; if (!target?.closest('.catalog-page__floating-search-menu, .catalog-page__floating-search-action') && this.floatingSearchOpen) { this.floatingSearchOpen = false; window.requestAnimationFrame(this.updateFloatingHeading); } }
  add(): void {
    this.clearBarcodeLookup();
    this.editing = null;
    this.value = draft();
    this.attributeDraft = '';
    this.image = null;
    this.imageError = '';
    this.errorKey = '';
    this.preview('');
    this.barcodeEntryOpen = this.kind === 'products';
    this.editorOpen = !this.barcodeEntryOpen;
  }
  continueAddingProduct(): void {
    this.clearBarcodeLookup();
    this.barcodeEntryOpen = false;
    this.editorOpen = true;
  }
  edit(record: CatalogRecord): void {
    this.attributeDraft = '';
    this.clearBarcodeLookup();
    this.barcodeEntryOpen = false;
    this.editing = record; this.value = { ...draft(), ...record, serviceMeasurement: record.serviceMeasurement || 'date_time', attributes: [...(record.attributes || [])], variations: (record.variations || [{ ...blankVariant(), key: 'default' }]).map(variant => ({
      key: variant.key, values: { ...variant.values }, barcode: variant.barcode || variant.gtin || '', gtin: variant.gtin || '',
      mrp: variant.mrp ?? '', baseUnit: variant.baseUnit ? { ...variant.baseUnit } : blankBaseUnit(),
      additionalUnits: (variant.additionalUnits || []).map(unit => ({ ...unit })),
    })), parentId: record.parentId || '', productIds: record.productIds || [], taxComponentIds: record.taxComponentIds || [], categoryIds: record.categoryIds || [], unitIds: record.unitIds || [], effectiveStart: record.effectiveStart?.slice(0, 10) || draft().effectiveStart, effectiveEnd: record.effectiveEnd?.slice(0, 10) || '', calculationType: record.calculationType || 'percentage', taxMode: record.taxMode || 'inherit' };
    this.image = null; this.imageError = ''; this.preview(''); this.editorOpen = true;
  }
  close(): void { if (this.isSaving || this.isProcessingImage) return; this.editorOpen = false; this.barcodeEntryOpen = false; this.clearBarcodeLookup(); this.image = null; this.preview(''); }
  clearBarcodeLookup(): void {
    clearTimeout(this.barcodeTimer);
    this.barcodeRequest?.unsubscribe();
    this.barcodeStatus = '';
    this.barcodeVariant = null;
    this.barcodeImages = [];
  }
  barcodeChanged(variant: VariantDraft, barcode: string): void {
    variant.barcode = barcode;
    variant.gtin = '';
    this.clearBarcodeLookup();
    this.barcodeTimer = setTimeout(() => this.lookupBarcode(variant, barcode), 600);
  }
  lookupBarcode(variant: VariantDraft, value: string): void {
    if (!this.value.variations.includes(variant)) return;
    if (this.barcodeVariant === variant && this.barcodeStatus === 'f028.lookupLoading') return;
    this.clearBarcodeLookup();
    const gtin = value.trim();
    if (!/^\d+$/.test(gtin) || ![8, 12, 13, 14].includes(gtin.length)) return;
    this.barcodeVariant = variant;
    this.barcodeStatus = 'f028.lookupLoading';
    this.barcodeRequest = this.api.lookupBarcode(gtin, this.businessId || undefined).subscribe({
      next: suggestion => {
        if (!suggestion) { this.barcodeStatus = 'f028.lookupMissing'; return; }
        if (!this.value.variations.includes(variant)) return;
        this.applyBarcodeSuggestion(variant, suggestion);
        if (this.barcodeEntryOpen) {
          this.barcodeEntryOpen = false;
          this.editorOpen = true;
        }
        this.barcodeStatus = 'f028.lookupFilled';
      },
      error: (error: HttpErrorResponse) => {
        this.barcodeStatus = error.status === 429 ? 'f028.lookupLimited'
          : error.status === 400 ? 'f028.invalidGtin' : 'f028.lookupFailed';
      },
    });
  }
  private applyBarcodeSuggestion(variant: VariantDraft, suggestion: BarcodeSuggestion): void {
    const { gtin, title, brand, attributes, mrp } = suggestion;
    if (variant === this.value.variations[0]) {
      this.value.name = title || this.value.name;
      this.value.title = title || this.value.title;
      this.value.brand = brand || this.value.brand;
      this.barcodeImages = suggestion.images;
    }
    variant.gtin = gtin;
    variant.barcode = gtin;
    if (mrp != null) variant.mrp = mrp;

    for (const [name, value] of Object.entries(attributes)) {
      const existing = this.value.attributes.find(attribute => attribute.toLowerCase() === name);
      if (!existing) this.value.attributes.push(name);
      variant.values[existing || name] = value;
    }
  }
  removeVariation(index: number): void {
    if (this.barcodeVariant === this.value.variations[index]) this.clearBarcodeLookup();
    this.value.variations.splice(index, 1);
  }
  async useBarcodeImage(url: string): Promise<void> {
    if (this.isProcessingImage || (this.businessId && this.editing && !this.editing.canEditImage)) return;
    this.isProcessingImage = true;
    this.imageError = '';
    try {
      const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(6000) });
      if (!response.ok || Number(response.headers.get('content-length')) > 5_000_000) throw new Error('Image unavailable');
      const data = await response.blob();
      if (data.size > 5_000_000) throw new Error('Image too large');
      if (this.editorOpen && this.barcodeImages.includes(url)) await this.process(new File([data], 'barcode-image', { type: data.type }), false);
    } catch {
      this.imageError = 'f028.lookupImageFailed';
    } finally {
      this.isProcessingImage = false;
    }
  }
  typeAttribute(input: HTMLInputElement): void {
    const parts = input.value.split(',');
    this.attributeDraft = parts.pop() ?? '';
    this.addAttributes(parts);
    if (parts.length) input.value = this.attributeDraft;
  }
  commitAttribute(input?: HTMLInputElement): void {
    this.addAttributes([this.attributeDraft]);
    this.attributeDraft = '';
    if (input) input.value = '';
  }
  private addAttributes(parts: string[]): void {
    for (const part of parts) {
      const name = part.trim();
      if (name && !this.value.attributes.some(attribute => attribute.toLowerCase() === name.toLowerCase())) {
        this.value.attributes.push(name);
      }
    }
  }
  removeAttribute(name: string): void {
    this.value.attributes = this.value.attributes.filter(attribute => attribute !== name);
    for (const variant of this.value.variations) delete variant.values[name];
  }
  toggle(field: 'productIds'|'taxComponentIds'|'categoryIds'|'unitIds', id: string, event: Event): void { const set = new Set(this.value[field]); if ((event.target as HTMLInputElement).checked) set.add(id); else set.delete(id); this.value = { ...this.value, [field]: [...set] }; }
  checked(field: 'productIds'|'taxComponentIds'|'categoryIds'|'unitIds', id: string): boolean { return this.value[field].includes(id); }
  addVariation(): void {
    const source = this.value.variations[0];
    this.value.variations.push({ ...blankVariant(), baseUnit: { ...source.baseUnit },
      additionalUnits: source.additionalUnits.map(unit => ({ ...unit })) });
  }
  addProductUnit(variation: VariantDraft): void { variation.additionalUnits.push({ key: 'unit_' + crypto.randomUUID(), name: '', symbol: '', dimension: variation.baseUnit.dimension, factorToBase: '1', conversionKind: 'product_specific', active: true, source: 'manual' }); }
  removeProductUnit(variation: VariantDraft, key: string): void { variation.additionalUnits = variation.additionalUnits.filter(u => u.key !== key); }
  unitLabel(id: string): string { const unit=this.units.find(item=>item.id===id); return unit ? `${unit.name} (${unit.symbol})` : ''; }

  tree(): Array<{ item: CatalogRecord; depth: number }> { const out: Array<{ item: CatalogRecord; depth: number }> = []; const walk = (parent: string|null, depth: number): void => { for (const item of this.categories.filter(c => (c.parentId || null) === parent)) { out.push({ item, depth }); if (this.expanded.has(item.id)) walk(item.id, depth + 1); } }; walk(null, 0); return out; }
  hasChildren(id: string): boolean { return this.categories.some(item => item.parentId === id); }
  toggleTree(id: string): void { if (this.expanded.has(id)) this.expanded.delete(id); else this.expanded.add(id); }
  path(id: string): string { const item = this.categories.find(c => c.id === id); return !item ? '' : item.parentId ? `${this.path(item.parentId)} / ${item.name}` : item.name; }
  productType(type: string): string { return type ? `f028.${type.toLowerCase()}` : 'f028.invalidProductType'; }
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
    if (this.isSaving || this.isProcessingImage || this.barcodeStatus === 'f028.lookupLoading' || !this.value.name.trim()) return;
    if (this.kind === 'products') this.commitAttribute();
    if (this.kind === 'products' && this.value.variations.some(variant => !variant.baseUnit.name || !variant.baseUnit.symbol)) { this.errorKey = 'f008.unitRequired'; return; }
    const payload = this.payload(this.kind, this.value); this.isSaving = true; this.errorKey = '';
    const call = this.kind === 'products' && this.image
      ? this.api.saveProduct(payload, this.image, this.editing?.id, this.businessId || undefined)
      : this.editing ? this.api.update(this.kind, this.editing.id, payload, this.businessId || undefined) : this.api.create(this.kind, payload, this.businessId || undefined);
    call.subscribe({ next: () => this.finishSave(), error: e => { this.isSaving = false; this.errorKey = this.errorFor(e); } });
  }
  private finishSave(): void { this.isSaving = false; this.clearBarcodeLookup(); this.editorOpen = false; this.noticeKey = 'f008.saved'; this.load(); }
  payload(kind: CatalogKind, d: Draft): Record<string, unknown> {
    if (kind === 'business-types') return { name:d.name,description:d.description,productIds:d.productIds,taxComponentIds:d.taxComponentIds };
    if (kind === 'products') return { name:d.name,title:d.title,brand:d.brand,attributes:d.attributes,variations:d.variations,serviceMeasurement:d.type === 'Services' ? d.serviceMeasurement : null,type:d.type,categoryIds:d.categoryIds,taxMode:d.taxMode,taxComponentIds:d.taxMode==='specific'?d.taxComponentIds:[] };
    if (kind === 'categories') return { name:d.name,parentId:d.parentId||null,unitIds:d.unitIds };
    if (kind === 'attributes') return { name:d.name,unitIds:d.unitIds };
    if (kind === 'units') return { name:d.name,symbol:d.symbol,dimension:d.dimension };
    return { name:d.name,calculationType:d.calculationType,value:Number(d.value),currency:d.currency,effectiveStart:d.effectiveStart,effectiveEnd:d.effectiveEnd||null,jurisdiction:d.jurisdiction,description:d.description };
  }
  openInline(kind: CatalogKind): void { this.inlineKind = kind; this.inline = draft(); this.inlineImage = null; this.inlineError = ''; this.inlinePreview = ''; }
  closeInline(): void { this.inlineKind = null; this.revoke(this.inlinePreview); this.inlinePreview = ''; }
  saveInline(): void {
    if (!this.inlineKind || !this.inline.name.trim()) return; const kind = this.inlineKind; const body = this.payload(kind, this.inline);
    if (kind === 'products' && !this.inline.variations[0].baseUnit.name) { this.inlineError = 'f008.unitRequired'; return; }
    this.isSaving = true; const call = kind === 'products' && this.inlineImage ? this.api.saveProduct(body, this.inlineImage, undefined, this.businessId || undefined) : this.api.create(kind, body, this.businessId || undefined);
    call.subscribe({ next: record => { this.isSaving = false; this.closeInline(); this.load(); this.selectInline(kind, record.id); }, error: e => { this.isSaving = false; this.inlineError = this.errorFor(e); } });
  }
  private selectInline(kind: CatalogKind, id: string): void {
    if (kind === 'products' && this.kind === 'business-types') this.value.productIds = [...this.value.productIds, id];
    if (kind === 'taxes' && (this.kind === 'business-types'||this.kind==='products')) this.value.taxComponentIds = [...this.value.taxComponentIds,id];
    if (kind === 'categories' && this.kind === 'products') this.value.categoryIds = [...this.value.categoryIds,id];
    if (kind === 'units' && (this.kind === 'attributes'||this.kind==='categories')) this.value.unitIds=[...this.value.unitIds,id];
  }
  inlinePayload(kind: CatalogKind): Record<string, unknown> { if(kind==='products')return {...this.payload(kind,this.inline),categoryIds:[],taxComponentIds:[],taxMode:'inherit'}; if(kind==='business-types')return {...this.payload(kind,this.inline),productIds:[],taxComponentIds:[]}; if(kind==='categories')return {...this.payload(kind,this.inline),unitIds:[]}; if(kind==='attributes')return {name:this.inline.name,unitIds:[]}; if(kind==='units')return this.payload(kind,this.inline); return this.payload(kind,this.inline); }
  askDelete(record: CatalogRecord): void { this.deleteTarget = record; this.deleteImpact = []; this.businessCopyCount = 0; this.deleteImpactLoading = true; this.api.deleteImpact(this.kind, record.id, this.businessId || undefined).subscribe({ next: result => { if (this.deleteTarget?.id === record.id) { this.deleteImpact = result.affected; this.businessCopyCount = result.businessCopyCount || 0; } this.deleteImpactLoading = false; }, error: () => { this.deleteImpactLoading = false; this.errorKey = 'f008.deleteImpactError'; this.deleteTarget = null; } }); }
  delete(scope?: 'admin-only' | 'all-copies'): void { const record=this.deleteTarget;if(!record)return;this.deleteTarget=null;this.api.delete(this.kind,record.id,this.businessId || undefined,scope).subscribe({next:()=>{this.noticeKey='f008.deleted';this.load();},error:(e:HttpErrorResponse)=>{this.errorKey=e.error?.error?.code==='BUSINESS_TYPE_IN_USE'?'f010.businessTypeInUse':e.error?.error?.code==='PRODUCT_COPIES_REQUIRE_CHOICE'?'f008.deleteImpactError':'f008.deleteError';} }); }
  imageUrl(record: CatalogRecord): Observable<SafeUrl> { return this.api.productImage(record.imageId || record.id, this.businessId || undefined); }
  categoryName(id: string): string { return this.path(id); }
  private errorFor(error: HttpErrorResponse): string { const code=error.error?.error?.code; const map:Record<string,string>={BUSINESS_CATALOG_PUSH_INCOMPLETE:'f028.catalogPushIncomplete',INVALID_PRODUCT_UNIT:'f026.invalidConversion',INVALID_CONVERSION:'f026.invalidConversion',PRODUCT_BASE_UNIT_IN_USE:'f026.baseInUse',PRODUCT_UNIT_MIGRATION_REQUIRED:'f026.repair',CATALOG_NAME_EXISTS:'f008.duplicate',PRODUCT_NAME_EXISTS:'f008.productDuplicate',PRODUCT_GTIN_EXISTS:'f028.gtinDuplicate',INVALID_GTIN:'f028.invalidGtin',INVALID_PRODUCT_TYPE:'f028.invalidProductType',INVALID_PRODUCT_VARIANTS:'f028.invalidVariants',INVALID_VARIANT_METADATA:'f028.invalidBarcode',INVALID_MRP:'f028.invalidMrp',PRODUCT_CODE_EXISTS:'f016.productCodeDuplicate',INVALID_PRODUCT_CODE:'f016.invalidProductCode',PRODUCT_UNIT_REQUIRED:'f008.unitRequired',PRODUCT_IMAGE_REQUIRED:'f008.imageRequired',PRODUCT_IMAGE_TOO_LARGE:'f008.imageTooLarge',INVALID_PRODUCT_IMAGE_CONTENT:'f008.imageInvalid',INVALID_REFERENCE:'f008.invalidReference',CATEGORY_CYCLE:'f008.categoryCycle',CURRENCY_REQUIRED:'f028.currencyRequired',INCOMPATIBLE_UNIT:'f008.incompatibleUnit'};return map[code]||'f008.saveError'; }
  private preview(url:string):void{this.revoke(this.imagePreview);this.imagePreview=url;}
  private revoke(url:string):void{if(url.startsWith('blob:'))URL.revokeObjectURL(url);}
}
