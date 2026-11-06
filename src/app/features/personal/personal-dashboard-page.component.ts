import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { PersonalApiService } from './personal-api.service';
import { PersonalDashboard } from './personal.models';

type SummaryFilter = 'all' | 'paid_by_me' | 'i_still_owe' | 'on_the_way';
@Component({ selector: 'app-personal-dashboard-page', standalone: false, templateUrl: './personal-dashboard-page.component.html', styleUrl: './personal-dashboard-page.component.scss' })
export class PersonalDashboardPageComponent implements OnInit, AfterViewInit, OnDestroy {
  data: PersonalDashboard | null = null; loading = true; errorKey = ''; page = 1; pageSize = 20;
  search = ''; debouncedSearch = ''; summary: SummaryFilter = 'all'; paymentStatus = 'all'; deliveryStatus = 'all'; method = 'all'; businessId = 'all';
  datePreset: 'all' | 'last30' | 'month' = 'all'; from = ''; to = '';
  floating = false; floatingTop = 0; floatingLeft = 0; floatingWidth = 0; floatingBarHeight = 60; filtersOpen = false;
  private scrollContainer: HTMLElement | null = null; private searchTimer?: ReturnType<typeof setTimeout>; private filterTimer?: ReturnType<typeof setTimeout>; private request = 0;
  private readonly onScroll = (): void => this.updateFloating();
  get pages(): number { return this.data ? Math.ceil(this.data.total / this.pageSize) : 1; }
  constructor(private readonly api: PersonalApiService, private readonly router: Router, private readonly route: ActivatedRoute) {}
  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.search = params.get('search') || ''; this.debouncedSearch = this.search;
    this.page = Math.max(1, Number(params.get('page') || '1'));
    const summary = params.get('summary'); if (summary && ['paid_by_me', 'i_still_owe', 'on_the_way'].includes(summary)) this.summary = summary as SummaryFilter;
    this.paymentStatus = params.get('paymentStatus') || 'all'; this.deliveryStatus = params.get('deliveryStatus') || 'all'; this.method = params.get('method') || 'all'; this.businessId = params.get('businessId') || 'all';
    this.from = params.get('from') || ''; this.to = params.get('to') || '';
    this.datePreset = params.get('datePreset') === 'last30' || params.get('datePreset') === 'month' ? params.get('datePreset') as 'last30' | 'month' : 'all';
    this.load();
  }
  ngAfterViewInit(): void { this.scrollContainer = document.querySelector<HTMLElement>('.workspace-content'); this.scrollContainer?.addEventListener('scroll', this.onScroll, { passive: true }); window.addEventListener('resize', this.onScroll, { passive: true }); requestAnimationFrame(this.onScroll); }
  ngOnDestroy(): void { this.scrollContainer?.removeEventListener('scroll', this.onScroll); window.removeEventListener('resize', this.onScroll); if (this.searchTimer) clearTimeout(this.searchTimer); if (this.filterTimer) clearTimeout(this.filterTimer); }
  private updateFloating(): void { const title = document.getElementById('personal-bills-title'); const header = document.querySelector<HTMLElement>('app-dashboard-header'); if (!title || !header) return; const rect = header.getBoundingClientRect(); this.floatingTop = rect.bottom; this.floatingLeft = rect.left; this.floatingWidth = rect.width; this.floating = title.getBoundingClientRect().top <= rect.bottom + 1; if (this.floating) requestAnimationFrame(() => { const bar = document.querySelector<HTMLElement>('.personal-floating'); if (bar) this.floatingBarHeight = bar.getBoundingClientRect().height; }); }
  load(): void {
    const sequence = ++this.request; this.loading = true; this.errorKey = '';
    this.api.dashboard({ page: this.page, pageSize: this.pageSize, search: this.debouncedSearch, summary: this.summary, paymentStatus: this.paymentStatus, deliveryStatus: this.deliveryStatus, method: this.method, businessId: this.businessId, from: this.from, to: this.to }).subscribe({
      next: response => { if (sequence !== this.request) return; this.data = response; this.loading = false; },
      error: (error: HttpErrorResponse) => { if (sequence !== this.request) return; this.loading = false; this.errorKey = error.status === 401 ? 'personal.sessionError' : 'personal.loadError'; if (error.status === 401) void this.router.navigateByUrl('/login'); },
    });
  }
  searchChanged(): void { if (this.searchTimer) clearTimeout(this.searchTimer); this.searchTimer = setTimeout(() => { this.debouncedSearch = this.search.trim(); this.page = 1; this.load(); }, 300); }
  filterChanged(): void { if (this.filterTimer) clearTimeout(this.filterTimer); this.filterTimer = setTimeout(() => { this.page = 1; this.load(); }, 300); }
  selectSummary(value: SummaryFilter): void { this.summary = this.summary === value ? 'all' : value; this.page = 1; this.load(); }
  selectBusiness(id: string): void { this.businessId = this.businessId === id ? 'all' : id; this.page = 1; this.load(); }
  chooseDatePreset(value: 'all' | 'last30' | 'month'): void {
    this.datePreset = value; const now = new Date(); const end = this.localDate(now);
    if (value === 'all') { this.from = ''; this.to = ''; }
    else if (value === 'last30') { const start = new Date(now); start.setDate(start.getDate() - 29); this.from = this.localDate(start); this.to = end; }
    else { this.from = this.localDate(new Date(now.getFullYear(), now.getMonth(), 1)); this.to = end; }
    this.page = 1; this.filterChanged();
  }
  rangeChanged(): void { this.datePreset = 'all'; this.page = 1; if (this.from && this.to && this.from > this.to) { this.errorKey = 'personal.invalidDateRange'; return; } this.filterChanged(); }
  private localDate(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  resetFilters(): void { this.search = ''; this.debouncedSearch = ''; this.summary = 'all'; this.paymentStatus = 'all'; this.deliveryStatus = 'all'; this.method = 'all'; this.businessId = 'all'; this.datePreset = 'all'; this.from = ''; this.to = ''; this.page = 1; this.load(); }
  openBill(id: string): void { void this.router.navigate(['bills', id], { relativeTo: this.route, queryParams: this.queryState() }); }
  changePage(delta: number): void { this.page = Math.max(1, this.page + delta); this.load(); this.scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' }); }
  paymentIcon(method: string): string { return ({ cash: '◉', upi: '⌁', card: '▤', bank_transfer: '↗' } as Record<string, string>)[method] || '◉'; }
  statusKey(status: string): string { return `f017.${status}`; }
  statusClass(status: string): string { return status.replace(/_/g, '-'); }
  businessLogo(url: string): string { return this.api.fileUrl(url); }
  queryState(): Record<string, string | number> { return { search: this.search, summary: this.summary, paymentStatus: this.paymentStatus, deliveryStatus: this.deliveryStatus, method: this.method, businessId: this.businessId, from: this.from, to: this.to, datePreset: this.datePreset, page: this.page }; }
  photoFailed(): void { if (this.data) this.data.user.photoUrl = ''; }
  hasActiveFilters(): boolean { return Boolean(this.search.trim() || this.summary !== 'all' || this.paymentStatus !== 'all' || this.deliveryStatus !== 'all' || this.method !== 'all' || this.businessId !== 'all' || this.from || this.to); }
}
