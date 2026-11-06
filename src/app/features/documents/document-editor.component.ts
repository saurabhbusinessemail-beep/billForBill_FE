import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { COUNTRY_CODES } from '../../shared/phone/country-codes';
import { parsePhoneE164 } from '../../shared/phone/phone.models';
import { DocumentsApiService } from './documents-api.service';
import { Router } from '@angular/router';
import { BusinessDocument, DocumentKind, DocumentLine, DocumentOptions, OrderType, ProductOption, TaxOption } from './documents.models';

@Component({ selector: 'app-document-editor', standalone: false, templateUrl: './document-editor.component.html', styleUrl: './document-editor.component.scss' })
export class DocumentEditorComponent implements OnChanges {
  @Input({ required: true }) businessId = '';
  @Input({ required: true }) kind: DocumentKind = 'orders';
  @Input() orderType: OrderType = 'sales';
  @Input() document: BusinessDocument | null = null;
  @Input() canDiscount = true;
  @Input() canTax = true;
  @Input() canCreateTax = false;
  @Input() canGenerateBill = false;
  @Input() canCreateBill = false;
  @Input() canConvert = false;
  @Input() canConvertToBill = false;
  @Input() canCreate = true;
  @Input() canEdit = true;
  @Output() readonly saved = new EventEmitter<BusinessDocument>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly loadingOptions = signal(false);
  readonly saving = signal(false);
  readonly errorKey = signal('');
  readonly options = signal<DocumentOptions>({ products: [], units: [], taxes: [] });
  readonly entryMode = signal<'detailed' | 'image_only'>('detailed');
  readonly contactName = signal('');
  readonly contactPhone = signal('');
  readonly contactCallingCode = signal('+91');
  readonly countryRegion = signal('US');
  readonly countries = COUNTRY_CODES;
  readonly contactAddress = signal('');
  readonly addressExpanded = signal(false);
  readonly contactUserId = signal<string | null>(null);
  readonly documentDate = signal(this.localDate());
  readonly imageCurrencyCode = signal('INR');
  readonly imageTaxableAmount = signal('');
  readonly imageTaxAmount = signal('0');
  readonly imageTaxDescription = signal('');
  readonly lines = signal<DocumentLine[]>([]);
  readonly orderDiscountType = signal<'fixed' | 'percentage'>('fixed');
  readonly orderDiscountValue = signal('');
  readonly selectedTaxIds = signal<string[]>([]);
  readonly selectedProductId = signal('');
  readonly draftQuantity = signal('1');
  readonly draftPrice = signal('');
  readonly draftPriceManual = signal(false);
  readonly imageFiles = signal<File[]>([]);
  readonly imageAcknowledged = signal(false);
  readonly deliveryCompleted = signal(true);
  readonly billDeliveryPrompt = signal<'order' | 'lead' | null>(null);
  readonly contactChecking = signal(false);
  readonly taxDialog = signal(false);
  readonly newTaxName = signal('');
  readonly newTaxType = signal<'fixed' | 'percentage'>('percentage');
  readonly newTaxValue = signal('');
  readonly subtotal = computed(() => this.lines().reduce((sum, line) => sum + this.cents(this.lineTotal(line)), 0) / 100);
  readonly discountTotal = computed(() => { const base = this.cents(this.subtotal()); const value = Number(this.orderDiscountValue()) || 0; const raw = this.orderDiscountType() === 'percentage' ? Math.round(base * value / 100) : this.cents(value); return Math.min(base, Math.max(0, raw)) / 100; });
  readonly afterDiscount = computed(() => Math.max(0, this.subtotal() - this.discountTotal()));
  readonly taxTotal = computed(() => this.selectedTaxIds().reduce((sum, id) => { const tax = this.options().taxes.find(item => item.id === id); if (!tax) return sum; const amount = tax.calculationType === 'percentage' ? Math.round(this.cents(this.afterDiscount()) * tax.value / 100) : this.cents(tax.value); return sum + Math.max(0, amount) / 100; }, 0));
  readonly grandTotal = computed(() => Math.round(this.cents(this.afterDiscount() + this.taxTotal())) / 100);
  readonly imageGrandTotal = computed(() => (Math.max(0, Number(this.imageTaxableAmount()) || 0) + Math.max(0, Number(this.imageTaxAmount()) || 0)).toFixed(2));
  readonly selectedProduct = computed(() => this.options().products.find(product => product.id === this.selectedProductId()) ?? null);
  readonly visibleTaxComponents = computed<TaxOption[]>(() => this.selectedTaxIds().flatMap(id => {
    const configured = this.options().taxes.find(tax => tax.id === id);
    if (configured) return [configured];
    const saved = this.document?.taxes?.find(tax => this.normalizeId(tax.taxId) === id);
    return saved ? [{ id, name: saved.name, calculationType: saved.calculationType, value: Number(saved.value), description: '' }] : [];
  }));
  readonly unitsForSelected = computed(() => this.unitsFor(this.selectedProduct()));
  readonly draftUnit = computed(() => { const product = this.selectedProduct(); const units = this.unitsFor(product); return units.find(unit => unit.id === product?.baseUnitId) || units[0] || null; });
  readonly draftTotal = computed(() => (Number(this.draftQuantity()) || 0) * (Number(this.draftPrice()) || 0));
  readonly orderLabel = computed(() => this.kind === 'leads' ? 'f015.lead' : this.orderType === 'purchase' ? 'f015.purchaseOrder' : 'f015.salesOrder');
  readonly isReadOnly = computed(() => Boolean((this.document && this.document.status !== 'open') || (this.document ? !this.canEdit : !this.canCreate)));
  readonly canSave = computed(() => !this.isReadOnly());

  constructor(private readonly api: DocumentsApiService, private readonly router: Router, auth: AuthService) { const code = parsePhoneE164(auth.currentUser()?.phoneE164)?.countryCallingCode || '+1'; this.contactCallingCode.set(code); this.countryRegion.set(COUNTRY_CODES.find(country => country.code === code)?.region || 'US'); }

  ngOnChanges(): void {
    if (!this.businessId) return;
    this.loadingOptions.set(true);
    this.api.options(this.businessId, this.kind).pipe(finalize(() => this.loadingOptions.set(false))).subscribe({
      next: options => {
        this.options.set(options);
        const doc = this.document;
        if (doc) {
          this.entryMode.set(doc.entryMode || 'detailed'); this.contactName.set(doc.contactSnapshot?.name || '');
          this.imageCurrencyCode.set(doc.currencyCode || 'INR'); this.imageTaxableAmount.set(doc.imageAmounts?.taxableAmount || ''); this.imageTaxAmount.set(doc.imageAmounts?.taxAmount || '0'); this.imageTaxDescription.set(doc.imageAmounts?.taxDescription || '');
          const savedPhone = doc.contactSnapshot?.phone || ''; const parsedPhone = parsePhoneE164(savedPhone);
          if (parsedPhone) { this.contactCallingCode.set(parsedPhone.countryCallingCode); this.countryRegion.set(COUNTRY_CODES.find(country => country.code === parsedPhone.countryCallingCode)?.region || this.countryRegion()); }
          this.contactPhone.set(parsedPhone?.phoneNumber || savedPhone); this.contactAddress.set(doc.contactSnapshot?.address || '');
          this.addressExpanded.set(Boolean(doc.contactSnapshot?.address));
          this.contactUserId.set(doc.contactUserId || null); this.documentDate.set(this.inputDate(doc.documentDate));
          this.deliveryCompleted.set(doc.deliveryCompleted ?? true);
          this.lines.set((doc.lines || []).map(line => this.withAvailableUnit(line)));
          this.orderDiscountType.set((doc.discounts?.[0]?.type as 'fixed' | 'percentage') || 'fixed');
          this.orderDiscountValue.set(doc.discounts?.[0]?.value || '');
          const savedTaxIds = (doc.taxes || []).map(tax => this.normalizeId((tax as unknown as { taxId?: unknown; id?: unknown; _id?: unknown }).taxId ?? (tax as unknown as { id?: unknown; _id?: unknown }).id ?? (tax as unknown as { _id?: unknown })._id)).filter(Boolean);
          this.selectedTaxIds.set(savedTaxIds.length || doc.taxSelectionSet ? savedTaxIds : options.taxes.map(tax => tax.id));
          this.imageAcknowledged.set(Boolean(doc.entryMode === 'image_only'));
        } else {
          this.entryMode.set('detailed'); this.deliveryCompleted.set(this.kind === 'leads' ? false : true); this.lines.set([]); this.selectedTaxIds.set(options.taxes.map(tax => tax.id)); this.documentDate.set(this.localDate()); this.addressExpanded.set(false); this.imageFiles.set([]); this.imageAcknowledged.set(false); this.imageCurrencyCode.set('INR'); this.imageTaxableAmount.set(''); this.imageTaxAmount.set('0'); this.imageTaxDescription.set('');
        }
      },
      error: error => this.errorKey.set(this.keyFor(error)),
    });
  }

  private localDate(): string { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  private normalizeId(value: unknown): string { if (typeof value === 'string') return value; if (value && typeof value === 'object') { const id = value as { id?: unknown; _id?: unknown }; return this.normalizeId(id.id ?? id._id); } return ''; }
  private inputDate(value: string): string { const match = /^\d{4}-\d\d-\d\d/.exec(value || ''); return match?.[0] || this.localDate(); }
  private dateWithOffset(dateOnly: string): string {
    const date = new Date(`${dateOnly}T00:00:00`); const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-'; const abs = Math.abs(offset);
    return `${dateOnly}T00:00:00.000${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  }
  private nowWithOffset(): string {
    const d = new Date(); const pad = (n: number) => String(n).padStart(2, '0'); const offset = -d.getTimezoneOffset(); const sign = offset >= 0 ? '+' : '-'; const abs = Math.abs(offset);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  }
  unitsFor(product: ProductOption | null) {
    if (!product) return [];
    const ids = [this.normalizeId(product.baseUnitId), ...product.additionalUnits.map(unit => this.normalizeId(unit.unitId))].filter(Boolean);
    return [...new Set(ids)].map(id => this.options().units.find(unit => unit.id === id)).filter((unit): unit is NonNullable<typeof unit> => Boolean(unit));
  }
  unitsForLine(line: DocumentLine) { return this.unitsFor(this.options().products.find(product => product.id === line.productId) || null); }
  hasProduct(productId: string): boolean { return this.options().products.some(product => product.id === productId); }
  trackLine(index: number): number { return index; }
  setCountryRegion(region: string): void { this.countryRegion.set(region); this.contactCallingCode.set(this.countries.find(country => country.region === region)?.code || '+1'); }
  private withAvailableUnit(line: DocumentLine): DocumentLine {
    const rawProductId = line.productId as unknown;
    const productId = typeof rawProductId === 'string' ? rawProductId : (rawProductId as { _id?: string; id?: string } | null)?.id || (rawProductId as { _id?: string; id?: string } | null)?._id || '';
    const rawUnitId = line.unitId as unknown;
    const unitId = typeof rawUnitId === 'string' ? rawUnitId : (rawUnitId as { _id?: string; id?: string } | null)?.id || (rawUnitId as { _id?: string; id?: string } | null)?._id || '';
    const normalized = { ...line, productId, unitId };
    const product = this.options().products.find(item => item.id === productId) || null; const units = this.unitsFor(product);
    if (units.some(unit => unit.id === unitId)) return normalized;
    const fallback = units.find(unit => unit.id === product?.baseUnitId) || units[0];
    return fallback ? { ...normalized, unitId: fallback.id, unitLabel: fallback.name } : normalized;
  }
  private resolvePrice(product: ProductOption, quantity: number): string | null {
    const price = product.price;
    if (!price) return null;
    if (this.kind === 'orders' && this.orderType === 'purchase') return price.purchaseCost;
    const matching = price.rules.filter(rule => rule.active && (!rule.customerUserId || rule.customerUserId === this.contactUserId()) && (rule.minimumQuantity == null || quantity >= rule.minimumQuantity))
      .sort((a, b) => Number(Boolean(b.customerUserId)) - Number(Boolean(a.customerUserId)) || (b.minimumQuantity || 0) - (a.minimumQuantity || 0));
    return matching[0]?.sellingPrice || price.defaultSellingPrice;
  }
  addProduct(): void {
    if (this.isReadOnly()) return;
    this.lines.update(lines => [...lines, { productId: '', productName: '', productCode: '', productDescription: '', quantity: '1', unitId: '', unitLabel: '', unitPrice: '0', priceOrigin: 'manual', manualOverride: false, sourcePrice: null }]);
  }
  updateLine(index: number, field: keyof DocumentLine, value: string): void {
    this.lines.update(lines => lines.map((line, i) => {
      if (i !== index) return line;
      const next = { ...line, [field]: value };
      if (field === 'unitPrice') { next.priceOrigin = 'manual'; next.manualOverride = true; }
      if (field === 'quantity' && !line.manualOverride) { const product = this.options().products.find(item => item.id === line.productId); const price = product ? this.resolvePrice(product, Number(value) || 1) : null; if (price != null) { next.unitPrice = price; next.sourcePrice = price; next.priceOrigin = 'master'; } }
      if (field === 'unitId') next.unitLabel = this.options().units.find(unit => unit.id === value)?.name;
      return next;
    }));
  }
  updateProduct(index: number, productId: string): void {
    if (!productId) {
      this.lines.update(lines => lines.map((line, i) => i === index ? { productId: '', productName: '', productCode: '', productDescription: '', quantity: '1', unitId: '', unitLabel: '', unitPrice: '0', priceOrigin: 'manual', manualOverride: false, sourcePrice: null, discount: null } : line));
      return;
    }
    const product = this.options().products.find(item => item.id === productId);
    if (!product) return;
    const units = this.unitsFor(product); const unit = units.find(item => item.id === product.baseUnitId) || units[0];
    const price = this.resolvePrice(product, 1) || '';
    this.lines.update(lines => lines.map((line, i) => i === index ? { ...line, productId: product.id, productName: product.name, productCode: product.code, productDescription: product.description, quantity: '1', unitId: unit?.id || '', unitLabel: unit?.name || '', unitPrice: price, priceOrigin: price ? 'master' : 'manual', manualOverride: !price, sourcePrice: price || null } : line));
  }
  removeLine(index: number): void { this.lines.update(lines => lines.filter((_line, i) => i !== index)); }
  toggleOrderDiscount(): void { this.orderDiscountValue.set(this.orderDiscountValue() !== '' ? '' : '0'); }
  private cents(value: number): number { return Math.round((Number.isFinite(value) ? value : 0) * 100); }
  lineTotal(line: DocumentLine): number { const gross = this.cents((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)); const discount = line.discount ? (line.discount.type === 'percentage' ? Math.round(gross * (Number(line.discount.value) || 0) / 100) : this.cents(Number(line.discount.value) || 0)) : 0; return Math.max(0, gross - Math.min(gross, Math.max(0, discount))) / 100; }
  lineDiscountAmount(line: DocumentLine): number { return Math.max(0, this.cents((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)) / 100 - this.lineTotal(line)); }
  toggleLineOffer(index: number): void { this.lines.update(lines => lines.map((line, i) => i === index ? { ...line, discount: line.discount ? null : { type: 'percentage', value: '0' } } : line)); }
  setLineDiscountType(index: number, type: 'fixed' | 'percentage'): void { this.lines.update(lines => lines.map((line, i) => i === index && line.discount ? { ...line, discount: { ...line.discount, type } } : line)); }
  setLineDiscount(index: number, value: string): void { this.lines.update(lines => lines.map((line, i) => i === index && line.discount ? { ...line, discount: { ...line.discount, value } } : line)); }
  toggleTax(id: string, checked: boolean): void { this.selectedTaxIds.update(ids => checked ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter(value => value !== id)); }
  removeTax(id: string): void { if (this.canTax && !this.isReadOnly()) this.toggleTax(id, false); }
  lookupContact(): void {
    const phone = this.contactPhone().trim(); if (!phone) return;
    this.contactChecking.set(true); this.errorKey.set('');
    this.api.lookupContact(this.businessId, this.kind, this.contactCallingCode(), phone).pipe(finalize(() => this.contactChecking.set(false))).subscribe({
      next: result => { const previousId = this.contactUserId(); this.contactUserId.set(result.userId || null); if (result.exists && result.name) this.contactName.set(result.name); else if (previousId) this.contactName.set(''); this.refreshAutoPrices(); },
      error: error => this.errorKey.set(this.keyFor(error)),
    });
  }
  changeContact(): void { this.contactUserId.set(null); this.contactName.set(''); this.contactPhone.set(''); this.contactAddress.set(''); this.refreshAutoPrices(); }
  private refreshAutoPrices(): void {
    this.lines.update(lines => lines.map(line => {
      if (line.manualOverride || line.priceOrigin === 'manual') return line;
      const product = this.options().products.find(item => item.id === line.productId); if (!product) return line;
      const price = this.resolvePrice(product, Number(line.quantity) || 1); return price == null ? line : { ...line, unitPrice: price, sourcePrice: price, priceOrigin: 'master' };
    }));
  }
  onFiles(event: Event): void {
    const input = event.target as HTMLInputElement; const files = Array.from(input.files || []);
    if (!files.length) return;
    const all = [...this.imageFiles(), ...files];
    if (all.length > 1 || all.some(file => file.size > 20 * 1024 * 1024) || all.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { this.errorKey.set('f015.imageLimitsError'); input.value = ''; return; }
    this.imageFiles.set(all); this.errorKey.set(''); input.value = '';
  }
  removeFile(index: number): void { this.imageFiles.update(files => files.filter((_file, i) => i !== index)); }
  setEntryMode(mode: 'detailed' | 'image_only'): void { this.entryMode.set(mode); if (mode === 'image_only' && !this.document) this.deliveryCompleted.set(false); }
  setImageTaxPercent(percent: number): void { this.imageTaxAmount.set(((Number(this.imageTaxableAmount()) || 0) * percent / 100).toFixed(2)); }
  save(): void {
    if (this.saving()) return; this.errorKey.set('');
    if (this.entryMode() === 'image_only') { this.saveImageOrder(); return; }
    this.submitDetailed('save');
  }
  generateBill(): void {
    if (this.saving() || this.kind !== 'orders') return;
    if (this.entryMode() === 'image_only') {
      this.startImageOrderBill(); return;
    }
    if (!this.deliveryCompleted()) { this.billDeliveryPrompt.set('order'); return; }
    this.submitDetailed('bill');
  }
  generateOrder(): void {
    if (this.saving() || this.kind !== 'leads') return;
    if (this.deliveryCompleted() && !this.canConvertToBill) { this.errorKey.set('f015.forbidden'); return; }
    if (this.document && !this.canEdit && this.document.status === 'open') { this.saving.set(true); this.api.convert(this.businessId, this.document, this.deliveryCompleted() ? 'bill' : 'order', this.deliveryCompleted()).pipe(finalize(() => this.saving.set(false))).subscribe({ next: value => this.saved.emit(value), error: error => this.errorKey.set(this.keyFor(error)) }); return; }
    this.submitDetailed('order');
  }
  generateLeadBill(): void {
    if (this.saving() || this.kind !== 'leads') return;
    if (!this.deliveryCompleted()) { this.billDeliveryPrompt.set('lead'); return; }
    this.startLeadBill();
  }
  resolveBillDelivery(delivered: boolean): void {
    const target = this.billDeliveryPrompt();
    if (!target) return;
    this.billDeliveryPrompt.set(null);
    this.deliveryCompleted.set(delivered);
    if (target === 'order') { if (this.entryMode() === 'image_only') this.startImageOrderBill(true); else this.submitDetailed('bill'); }
    else this.startLeadBill();
  }
  cancelBillDeliveryPrompt(): void { this.billDeliveryPrompt.set(null); }
  private startImageOrderBill(deliveryChoiceConfirmed = false): void {
    if (!this.canCreateBill) { this.errorKey.set('f017.billPermissionRequired'); return; }
    if (!deliveryChoiceConfirmed && !this.deliveryCompleted()) { this.billDeliveryPrompt.set('order'); return; }
    if (!this.document) { this.saveImageOrder(order => this.performOrderBill(order), true); return; }
    if (!this.document.contactUserId) { this.errorKey.set('f017.partyMissing'); return; }
    // The delivery choice belongs to the bill being created. Do not persist it
    // to the source image order before the bill editor opens.
    this.performOrderBill(this.document);
  }
  private startLeadBill(): void {
    if (this.document && (!this.canEdit || this.document.status === 'ordered') && (this.document.status === 'open' || this.document.status === 'ordered')) { this.saving.set(true); this.api.convert(this.businessId, this.document, 'bill', this.deliveryCompleted()).pipe(finalize(() => this.saving.set(false))).subscribe({ next: value => { if (value.id && value.contactUserId) this.createBillForOrder(value.id, value.contactUserId, 'sale'); else this.saved.emit(value); }, error: error => this.errorKey.set(this.keyFor(error)) }); return; }
    this.submitDetailed('bill');
  }
  private taxSelectionPayload(): Array<Record<string, unknown>> {
    return this.selectedTaxIds().map(taxId => {
      const tax = this.options().taxes.find(item => item.id === taxId);
      const saved = this.document?.taxes?.find(item => this.normalizeId(item.taxId) === taxId);
      const source = tax || saved;
      return {
        taxId,
        ...(source ? {
          name: source.name,
          calculationType: source.calculationType,
          value: String(source.value),
          currency: source.currency || '',
          jurisdiction: source.jurisdiction || '',
          description: source.description || '',
          effectiveStart: source.effectiveStart || null,
          effectiveEnd: source.effectiveEnd || null,
          revision: source.revision || '',
        } : {}),
      };
    });
  }
  private documentBody(): Record<string, unknown> { return { version: this.document?.version, entryMode: 'detailed', orderType: this.orderType, ...(this.kind === 'orders' ? { deliveryCompleted: this.deliveryCompleted() } : {}), documentDate: this.dateWithOffset(this.documentDate()), createdAtClient: this.document?.createdAtClient || this.nowWithOffset(), contactUserId: this.contactUserId(), contact: { name: this.contactName(), countryCallingCode: this.contactCallingCode(), phoneNumber: this.contactPhone(), address: this.contactAddress() }, lines: this.lines(), discounts: this.orderDiscountValue() !== '' ? [{ type: this.orderDiscountType(), value: this.orderDiscountValue() }] : [], taxes: this.taxSelectionPayload() }; }
  private submitDetailed(action: 'save' | 'order' | 'bill'): void {
    if (this.isReadOnly() && !(action === 'bill' && this.kind === 'orders' && this.canGenerateBill && this.document && this.document.status !== 'cancelled')) return;
    if (!this.contactName().trim()) { this.errorKey.set('f015.contactRequired'); return; }
    if (!this.lines().length) { this.errorKey.set('f015.addProductRequired'); return; }
    if (this.lines().some(line => !line.productId || !line.unitId)) { this.errorKey.set('f015.addProductRequired'); return; }
    const amount = Number(this.orderDiscountValue()); if (this.orderDiscountValue() && (!Number.isFinite(amount) || amount < 0 || (this.orderDiscountType() === 'percentage' && amount > 100) || (this.orderDiscountType() === 'fixed' && amount > this.subtotal()))) { this.errorKey.set('f015.invalidDiscount'); return; }
    if (this.lines().some(line => { if (!line.discount) return false; const offer = Number(line.discount.value); const gross = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0); return !line.discount.value.trim() || !Number.isFinite(offer) || offer < 0 || (line.discount.type === 'percentage' && offer > 100) || (line.discount.type === 'fixed' && offer > gross); })) { this.errorKey.set('f015.invalidDiscount'); return; }
    this.saving.set(true); this.errorKey.set('');
    if (this.kind === 'orders' && action === 'bill' && this.document && (!this.canEdit || this.document.status !== 'open')) { this.performOrderBill(this.document); return; }
    const body = this.documentBody(); const request = this.document ? this.api.update(this.businessId, this.kind, this.document.id, body) : this.api.create(this.businessId, this.kind, body);
    request.subscribe({ next: value => {
      if (action === 'save') { this.saving.set(false); this.saved.emit(value); return; }
      if (this.kind === 'orders') { this.performOrderBill(value); return; }
      const mode = action === 'bill' || (action === 'order' && this.deliveryCompleted()) ? 'bill' : 'order';
      this.api.convert(this.businessId, value, mode, this.deliveryCompleted()).pipe(finalize(() => this.saving.set(false))).subscribe({ next: converted => { if (mode === 'bill' && converted.id && converted.contactUserId) this.createBillForOrder(converted.id, converted.contactUserId, 'sale'); else this.saved.emit(converted); }, error: error => this.errorKey.set(this.keyFor(error)) });
    }, error: error => { this.saving.set(false); this.errorKey.set(this.keyFor(error)); } });
  }
  private performOrderBill(order: BusinessDocument): void {
    if (!this.canCreateBill || !order.contactUserId) { this.saving.set(false); this.errorKey.set(!this.canCreateBill ? 'f017.billPermissionRequired' : 'f017.partyMissing'); return; }
    this.createBillForOrder(order.id, order.contactUserId, order.orderType === 'purchase' ? 'purchase' : 'sale', order.entryMode === 'image_only' ? 'image' : 'detailed');
  }
  private createBillForOrder(orderId: string, _partyUserId: string, billType: 'sale' | 'purchase', entryMode = 'detailed'): void {
    this.saving.set(false); this.cancelled.emit();
    void this.router.navigate(['/dashboard', this.businessId, 'bills'], { queryParams: { createForOrder: orderId, billType, deliveredAtIssue: this.deliveryCompleted(), entryMode } });
  }
  private saveImageOrder(afterSave?: (order: BusinessDocument) => void, forBill = false): void {
    if (!this.imageAcknowledged()) { this.errorKey.set('f015.imageAckRequired'); return; }
    if (!this.document?.imageMetadata?.length && !this.imageFiles().length) { this.errorKey.set('f015.imageRequired'); return; }
    if (!this.contactPhone().trim()) { this.errorKey.set('phone.invalid'); return; }
    if (!this.contactName().trim()) { this.errorKey.set('f015.contactRequired'); return; }
    const taxableAmount = String(this.imageTaxableAmount() ?? '').trim(); const taxAmount = String(this.imageTaxAmount() ?? '0').trim();
    if (!taxableAmount || !Number.isFinite(Number(taxableAmount)) || Number(taxableAmount) < 0 || !Number.isFinite(Number(taxAmount)) || Number(taxAmount) < 0) { this.errorKey.set('f015.imageAmountsRequired'); return; }
    if (this.document) {
      this.saving.set(true);
      this.api.update(this.businessId, 'orders', this.document.id, { version: this.document.version, entryMode: 'image_only', orderType: this.orderType, documentDate: this.dateWithOffset(this.documentDate()), acknowledgedNoStoreChange: true, deliveryCompleted: this.deliveryCompleted(), currencyCode: this.imageCurrencyCode(), imageAmounts: { taxableAmount, taxAmount, taxDescription: this.imageTaxDescription().trim() }, contact: { name: this.contactName().trim(), countryCallingCode: this.contactCallingCode(), phoneNumber: this.contactPhone().trim(), address: this.contactAddress().trim() } }).subscribe({ next: order => { this.saving.set(false); if (afterSave) { afterSave(order); return; } this.saved.emit(order); }, error: error => { this.saving.set(false); this.errorKey.set(this.keyFor(error)); } });
      return;
    }
    this.saving.set(true); const files = [...this.imageFiles()];
    const metadata = { documentDate: this.dateWithOffset(this.documentDate()), createdAtClient: this.nowWithOffset(), acknowledgedNoStoreChange: true, deliveryCompleted: forBill ? false : this.deliveryCompleted(), currencyCode: this.imageCurrencyCode(), imageAmounts: { taxableAmount, taxAmount, taxDescription: this.imageTaxDescription().trim() }, contact: { name: this.contactName().trim(), countryCallingCode: this.contactCallingCode(), phoneNumber: this.contactPhone().trim(), address: this.contactAddress().trim() } };
    this.api.createImageOrder(this.businessId, this.orderType, files[0], metadata).subscribe({
      next: order => this.uploadRemaining(order, files.slice(1), true, afterSave),
      error: error => { this.saving.set(false); this.errorKey.set(this.keyFor(error)); },
    });
  }
  private uploadRemaining(order: BusinessDocument, files: File[], createdNow: boolean, afterSave?: (order: BusinessDocument) => void): void {
    if (!files.length) { this.saving.set(false); if (afterSave) afterSave(order); else this.saved.emit(order); return; }
    const file = files[0]; this.api.attachImage(this.businessId, order.id, file).subscribe({
      next: image => { order.imageMetadata = [...(order.imageMetadata || []), { id: image.id, filename: file.name, contentType: file.type, size: file.size, width: 0, height: 0 }]; order.imageIds = [...(order.imageIds || []), image.id]; this.uploadRemaining(order, files.slice(1), createdNow, afterSave); },
      error: error => { this.saving.set(false); this.errorKey.set(this.keyFor(error)); if (createdNow) this.api.abortImageOrder(this.businessId, order.id).subscribe(); },
    });
  }
  createTax(): void {
    if (!this.newTaxName().trim() || !this.newTaxValue()) return;
    this.api.addTax(this.businessId, { name: this.newTaxName(), calculationType: this.newTaxType(), value: this.newTaxValue() }).subscribe({ next: tax => { this.options.update(options => ({ ...options, taxes: [...options.taxes, tax] })); this.selectedTaxIds.update(ids => [...ids, tax.id]); this.taxDialog.set(false); this.newTaxName.set(''); this.newTaxValue.set(''); }, error: error => this.errorKey.set(this.keyFor(error)) });
  }
  showAddBillInfo(): void { this.errorKey.set('f015.addBillFuture'); }
  imageUrl(image: { _id?: string; id?: string }, order: BusinessDocument | null): string { const id = image._id || image.id || ''; return order && id ? this.api.imageUrl(this.businessId, order.id, id) : ''; }
  imageCurrency(value: string | number): string { return new Intl.NumberFormat(undefined, { style: 'currency', currency: this.imageCurrencyCode(), minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0); }
  formatDate(value: string): string { return value?.slice(0, 10) || ''; }
  private keyFor(error: HttpErrorResponse): string { const code = error.error?.error?.code; if (code === 'INSUFFICIENT_STOCK') return 'f015.insufficientStock'; if (code === 'PERMISSION_DENIED') return 'f015.forbidden'; if (code === 'DOCUMENT_STALE') return 'f015.stale'; if (code === 'PRICE_REQUIRED') return 'f015.priceRequired'; if (code === 'INVALID_DISCOUNT' || code === 'DISCOUNT_EXCEEDS_TOTAL') return 'f015.invalidDiscount'; if (code === 'INVALID_TAX') return 'f015.invalidTax'; if (code === 'INVALID_ORDER_TRANSITION') return 'f015.actionError'; if (code === 'INVALID_PHONE') return 'phone.invalid'; if (code === 'CONTACT_NAME_REQUIRED') return 'f015.contactRequired'; if (code === 'IMAGE_ACK_REQUIRED') return 'f015.imageAckRequired'; if (code === 'ORDER_IMAGE_TOO_LARGE' || code === 'ORDER_IMAGE_LIMIT_REACHED' || code === 'ORDER_IMAGE_SET_TOO_LARGE') return 'f015.imageLimitsError'; return 'f015.saveError'; }
}
