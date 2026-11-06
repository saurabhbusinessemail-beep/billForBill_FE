import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { InventoryApiService } from './inventory-api.service';
import { InventoryBalanceReport, InventoryProductOption, InventoryUnit } from './inventory.models';
type Range = 'last30' | 'last3' | 'year' | 'custom';
@Component({ selector: 'app-reports-page', standalone: false, templateUrl: './reports-page.component.html', styleUrl: './inventory-page.component.scss' })
export class ReportsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  businessId = ''; products: InventoryProductOption[] = []; productId = ''; startDate = ''; endDate = ''; unitId = ''; range: Range = 'last3'; report: InventoryBalanceReport | null = null; loading = false; optionsLoading = true; errorKey = ''; dateError = false; filtersOpen = false;
  floatingHeading = false; floatingTop = 0; floatingLeft = 0; floatingWidth = 0; toolbarTop = 0; private floatingBarHeight = 64; private scrollContainer: HTMLElement | null = null; private resizeObserver: ResizeObserver | null = null; private routeSubscription?: { unsubscribe(): void };
  private readonly updateFloatingHeading = (): void => {
    const title = document.getElementById('reports-title'); const header = document.querySelector<HTMLElement>('app-dashboard-header');
    if (!title || !header) return;
    const rect = header.getBoundingClientRect(); this.floatingTop = rect.bottom; this.floatingLeft = rect.left; this.floatingWidth = rect.width; this.toolbarTop = rect.bottom + this.floatingBarHeight;
    const before = this.floatingHeading; this.floatingHeading = title.getBoundingClientRect().top <= rect.bottom + 1 || this.filtersOpen;
    if (this.floatingHeading && !before) window.requestAnimationFrame(this.updateFloatingHeading);
  };
  constructor(private readonly route: ActivatedRoute, readonly api: InventoryApiService) {}
  ngOnInit(): void { this.routeSubscription = this.route.paramMap.subscribe(params => { this.businessId = params.get('businessId') || ''; this.setRange('last3'); this.loadOptions(); }); }
  ngAfterViewInit(): void { this.scrollContainer = document.querySelector<HTMLElement>('.workspace-content'); const bar = document.querySelector<HTMLElement>('.reports__floating-bar'); if (bar) { this.resizeObserver = new ResizeObserver(() => { this.floatingBarHeight = bar.getBoundingClientRect().height; this.updateFloatingHeading(); }); this.resizeObserver.observe(bar); } this.scrollContainer?.addEventListener('scroll', this.updateFloatingHeading, { passive: true }); window.addEventListener('resize', this.updateFloatingHeading, { passive: true }); this.updateFloatingHeading(); }
  ngOnDestroy(): void { this.routeSubscription?.unsubscribe(); this.resizeObserver?.disconnect(); this.scrollContainer?.removeEventListener('scroll', this.updateFloatingHeading); window.removeEventListener('resize', this.updateFloatingHeading); }
  private toDate(value: Date): string { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
  private today(): Date { const value = new Date(); return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
  setRange(value: Range): void { this.range = value; const end = this.today(); const start = new Date(end); if (value === 'last30') start.setDate(start.getDate() - 29); else if (value === 'last3') { const day = start.getDate(); start.setDate(1); start.setMonth(start.getMonth() - 3); start.setDate(Math.min(day, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate())); } else if (value === 'year') { start.setMonth(0, 1); } if (value !== 'custom') { this.startDate = this.toDate(start); this.endDate = this.toDate(end); this.loadReport(); } }
  loadOptions(): void { this.optionsLoading = true; this.errorKey = ''; this.api.reportOptions(this.businessId).subscribe({ next: value => { this.products = value.products; this.optionsLoading = false; }, error: (error: HttpErrorResponse) => { this.errorKey = error.status === 403 ? 'f016.forbidden' : 'f016.reportLoadError'; this.optionsLoading = false; } }); }
  get selectedProduct(): InventoryProductOption | undefined { return this.products.find(item => item.id === this.productId); }
  get units(): InventoryUnit[] { return this.selectedProduct?.units || []; }
  selectProduct(id: string): void { this.productId = id; this.unitId = this.selectedProduct?.baseUnitId || this.units[0]?.id || ''; this.loadReport(); }
  loadReport(): void {
    this.report = null; this.dateError = false; if (!this.productId || !this.startDate || !this.endDate) return;
    if (this.startDate > this.endDate) { this.dateError = true; return; }
    this.loading = true; this.errorKey = '';
    this.api.report(this.businessId, this.productId, this.startDate, this.endDate, this.unitId).subscribe({ next: value => { this.report = value; this.loading = false; }, error: (error: HttpErrorResponse) => { this.loading = false; this.errorKey = error.status === 403 ? 'f016.forbidden' : 'f016.reportLoadError'; } });
  }
  unitChanged(value: string): void { this.unitId = value; this.loadReport(); }
  markCustom(): void { this.range = 'custom'; this.loadReport(); }
  date(value: string): string { if (!value) return ''; const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day).toLocaleDateString(); }
  reason(row: { reason: string; direction: string }): string { const key = `f016.reason.${row.reason}`; return row.reason === 'other' ? 'f016.reason.other' : row.reason === 'opening' ? 'f016.reason.opening' : row.reason === 'count' ? 'f016.reason.count' : row.reason === 'damage' ? 'f016.reason.damage' : row.reason === 'correction' ? 'f016.reason.correction' : key; }
  print(): void { window.print(); }
  @HostListener('document:keydown.escape') escape(): void { this.filtersOpen = false; }
  @HostListener('document:click', ['$event']) outside(event: MouseEvent): void { const target = event.target as HTMLElement | null; if (this.filtersOpen && !target?.closest('.reports__filter-popup,.reports__filter-action')) this.filtersOpen = false; }
}
