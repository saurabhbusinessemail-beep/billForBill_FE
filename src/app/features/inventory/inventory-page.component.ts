import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { InventoryApiService } from './inventory-api.service';
import { InventoryItem, InventoryLedger, InventoryList, InventoryProductOption, InventoryUnit } from './inventory.models';

type Reason = 'opening' | 'damage' | 'count' | 'correction' | 'other';
@Component({ selector: 'app-inventory-page', standalone: false, templateUrl: './inventory-page.component.html', styleUrl: './inventory-page.component.scss' })
export class InventoryPageComponent implements OnInit, AfterViewInit, OnDestroy {
  businessId = ''; data: InventoryList | null = null; loading = true; errorKey = ''; noticeKey = '';
  search = ''; categoryId = ''; stockLevel = ''; canView = false; canAdjust = false;
  floatingHeading = false; floatingTop = 0; floatingLeft = 0; floatingWidth = 0; toolbarTop = 0; toolbarLeft = 0; toolbarWidth = 0; private floatingBarHeight = 64; filtersOpen = false;
  adjustOpen = false; saving = false; confirmRemoval = false; direction: 'in' | 'out' = 'in'; productId = ''; quantity = ''; unitId = ''; effectiveDate = this.today(); reason: Reason = 'count'; note = ''; formErrorKey = '';
  ledger: InventoryLedger | null = null; ledgerLoading = false; ledgerErrorKey = '';
  reorderDraft: Record<string, string> = {}; reorderSaving = '';
  preservedMinHeight: number | null = null;
  private scrollContainer: HTMLElement | null = null; private resizeObserver: ResizeObserver | null = null; private routeSubscription?: { unsubscribe(): void }; private searchSubscription?: { unsubscribe(): void }; private loadSequence = 0; private readonly searchChanges = new Subject<string>();
  private readonly updateFloatingHeading = (): void => {
    const title = document.getElementById('inventory-title'); const header = document.querySelector<HTMLElement>('app-dashboard-header');
    if (!title || !header) return;
    const rect = header.getBoundingClientRect(); this.floatingTop = rect.bottom; this.floatingLeft = rect.left; this.floatingWidth = rect.width;
    const floatingBar = document.querySelector<HTMLElement>('.inventory__floating-bar');
    const floatingBarHeight = floatingBar?.getBoundingClientRect().height || this.floatingBarHeight;
    this.toolbarTop = rect.bottom + floatingBarHeight;
    const contentRect = document.querySelector<HTMLElement>('.inventory__header')?.getBoundingClientRect();
    if (contentRect) { this.toolbarLeft = contentRect.left; this.toolbarWidth = contentRect.width; }
    const before = this.floatingHeading; const shouldFloat = title.getBoundingClientRect().top <= rect.bottom + 1 || this.filtersOpen;
    if (!shouldFloat && this.preservedMinHeight !== null) this.preservedMinHeight = null;
    this.floatingHeading = shouldFloat;
    if (this.floatingHeading && !before) window.requestAnimationFrame(this.updateFloatingHeading);
  };
  constructor(private readonly route: ActivatedRoute, readonly api: InventoryApiService) {}
  ngOnInit(): void { this.searchSubscription = this.searchChanges.pipe(debounceTime(250), distinctUntilChanged()).subscribe(() => this.load(true)); this.routeSubscription = this.route.paramMap.subscribe(params => { this.businessId = params.get('businessId') || ''; this.load(); }); }
  ngAfterViewInit(): void { this.scrollContainer = document.querySelector<HTMLElement>('.workspace-content'); const bar = document.querySelector<HTMLElement>('.inventory__floating-bar'); if (bar) { this.resizeObserver = new ResizeObserver(() => { this.floatingBarHeight = bar.getBoundingClientRect().height; this.updateFloatingHeading(); }); this.resizeObserver.observe(bar); } this.scrollContainer?.addEventListener('scroll', this.updateFloatingHeading, { passive: true }); window.addEventListener('resize', this.updateFloatingHeading, { passive: true }); this.updateFloatingHeading(); }
  ngOnDestroy(): void { this.routeSubscription?.unsubscribe(); this.searchSubscription?.unsubscribe(); this.searchChanges.complete(); this.resizeObserver?.disconnect(); this.scrollContainer?.removeEventListener('scroll', this.updateFloatingHeading); window.removeEventListener('resize', this.updateFloatingHeading); }
  private today(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  searchChanged(): void { this.searchChanges.next(this.search); }
  load(preserveView = false): void {
    const requestId = ++this.loadSequence;
    const container = this.scrollContainer;
    const savedScrollTop = preserveView ? container?.scrollTop : undefined;
    const keepFloating = Boolean(preserveView && this.floatingHeading && container);
    const floatingScrollTop = keepFloating ? this.floatingScrollThreshold() : undefined;
    const inventory = document.querySelector<HTMLElement>('.inventory');
    const containerRect = container?.getBoundingClientRect();
    const inventoryTop = inventory && container && containerRect ? inventory.getBoundingClientRect().top - containerRect.top + container.scrollTop : 0;
    if (!preserveView) this.loading = true;
    this.errorKey = '';
    this.api.list(this.businessId, this.search, this.categoryId, this.stockLevel).subscribe({ next: result => {
      if (requestId !== this.loadSequence) return;
      this.data = result; this.canView = Boolean(result.authorization?.isOwner || result.authorization?.permissionKeys.includes('business.inventory.view')); this.canAdjust = Boolean(result.authorization?.isOwner || result.authorization?.permissionKeys.includes('business.inventory.adjust')); this.reorderDraft = Object.fromEntries(result.items.map(item => [item.id, item.reorderLevel])); this.loading = false;
      if (container && savedScrollTop !== undefined) {
        if (keepFloating && floatingScrollTop !== undefined) this.preservedMinHeight = Math.max(this.preservedMinHeight || 0, floatingScrollTop + container.clientHeight - inventoryTop + 8);
        window.requestAnimationFrame(() => { if (container.scrollTop !== (keepFloating ? floatingScrollTop : savedScrollTop)) container.scrollTop = keepFloating ? floatingScrollTop! : savedScrollTop; this.updateFloatingHeading(); });
      } else window.requestAnimationFrame(this.updateFloatingHeading);
    }, error: (error: HttpErrorResponse) => { if (requestId !== this.loadSequence) return; this.errorKey = error.status === 403 ? 'f016.forbidden' : 'f016.loadError'; this.loading = false; } });
  }
  private floatingScrollThreshold(): number {
    if (!this.scrollContainer) return 0;
    const title = document.getElementById('inventory-title'); const header = document.querySelector<HTMLElement>('app-dashboard-header');
    if (!title || !header) return this.scrollContainer.scrollTop;
    const containerTop = this.scrollContainer.getBoundingClientRect().top;
    const titleOffset = title.getBoundingClientRect().top - containerTop + this.scrollContainer.scrollTop;
    return Math.max(0, titleOffset - (header.getBoundingClientRect().bottom - containerTop) + 2);
  }
  get products(): InventoryProductOption[] { return this.data?.products || []; }
  get selectedProduct(): InventoryProductOption | undefined { return this.products.find(item => item.id === this.productId); }
  get selectedUnits(): InventoryUnit[] { return this.selectedProduct?.units || []; }
  openAdjustment(product?: InventoryItem): void {
    this.direction = 'in'; this.productId = product?.id || ''; this.quantity = ''; this.unitId = product?.baseUnitId || ''; this.effectiveDate = this.today(); this.reason = product ? 'count' : 'opening'; this.note = ''; this.formErrorKey = ''; this.noticeKey = ''; this.confirmRemoval = false; this.adjustOpen = true; window.requestAnimationFrame(this.updateFloatingHeading);
  }
  setProduct(value: string): void { this.productId = value; this.unitId = this.selectedProduct?.baseUnitId || this.selectedUnits[0]?.id || ''; this.formErrorKey = ''; }
  requestSave(): void {
    this.formErrorKey = '';
    if (!this.productId || !this.quantity || !this.unitId || !this.effectiveDate || (this.reason === 'other' && !this.note.trim())) { this.formErrorKey = 'f016.requiredFields'; return; }
    if (this.direction === 'out' && !this.confirmRemoval) { this.confirmRemoval = true; return; }
    this.saving = true;
    this.api.adjust(this.businessId, { productId: this.productId, direction: this.direction, quantity: this.quantity, unitId: this.unitId, effectiveDate: this.effectiveDate, reason: this.reason, note: this.note }).subscribe({ next: () => { this.adjustOpen = false; this.saving = false; this.noticeKey = 'f016.adjustmentSaved'; this.load(); }, error: (error: HttpErrorResponse) => { this.saving = false; this.confirmRemoval = false; this.formErrorKey = error.error?.error?.code === 'INSUFFICIENT_STOCK' ? 'f016.insufficientStock' : error.error?.error?.code === 'INVALID_UNIT' ? 'f016.invalidUnit' : 'f016.saveError'; } });
  }
  closeAdjustment(): void { if (!this.saving) { this.adjustOpen = false; this.confirmRemoval = false; this.updateFloatingHeading(); } }
  openLedger(item: InventoryItem): void { this.ledgerLoading = true; this.ledgerErrorKey = ''; this.ledger = null; this.api.ledger(this.businessId, item.id).subscribe({ next: result => { this.ledger = result; this.ledgerLoading = false; }, error: () => { this.ledgerErrorKey = 'f016.ledgerError'; this.ledgerLoading = false; } }); }
  closeLedger(): void { this.ledger = null; }
  saveReorderLevel(item: InventoryItem): void { const value = this.reorderDraft[item.id] ?? ''; this.reorderSaving = item.id; this.api.reorderLevel(this.businessId, item.id, value).subscribe({ next: () => { this.reorderSaving = ''; this.load(); }, error: () => { this.reorderSaving = ''; this.errorKey = 'f016.reorderSaveError'; } }); }
  statusKey(status: InventoryItem['status']): string { return `f016.status.${status}`; }
  reasonKey(reason: string): string { return `f016.reason.${reason}`; }
  date(value: string | null): string { if (!value) return '—'; const [y,m,d] = value.slice(0,10).split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString(); }
  quantityDisplay(value: string, symbol: string): string { return `${value} ${symbol}`.trim(); }
  trackById(_index: number, value: { id: string }): string { return value.id; }
  @HostListener('document:keydown.escape') escape(): void { if (this.filtersOpen) this.filtersOpen = false; else if (this.adjustOpen) this.closeAdjustment(); else if (this.ledger) this.closeLedger(); }
  @HostListener('document:click', ['$event']) outside(event: MouseEvent): void { const target = event.target as HTMLElement | null; if (this.filtersOpen && !target?.closest('.inventory__filter-popup,.inventory__filter-action')) this.filtersOpen = false; }
}
