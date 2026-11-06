import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BusinessPlansApiService } from './business-plans-api.service';
import { BusinessPlansDashboard, FeaturedBusinessOffer } from './business-plans.models';

@Component({ selector: 'app-business-plans-page', standalone: false, templateUrl: './business-plans-page.component.html', styleUrls: ['./business-plans-page.component.scss'] })
export class BusinessPlansPageComponent implements OnInit, AfterViewInit, OnDestroy {
  businessId = '';
  dashboard: BusinessPlansDashboard | null = null;
  loading = true;
  loadError = false;
  success = false;
  planDialog = false;
  creditDialog = false;
  promotedPlanId = '';
  promotedOfferCode = '';
  floating = false;
  floatingTop = 0;
  floatingLeft = 0;
  floatingWidth = 0;
  private scrollContainer: HTMLElement | null = null;
  private readonly updateFloating = () => {
    const title = document.getElementById('f024-title'); const head = document.querySelector<HTMLElement>('app-dashboard-header');
    const page = document.getElementById('f024-page');
    if (!title || !head || !page) return;
    const headBottom = head.getBoundingClientRect().bottom; const pageRect = page.getBoundingClientRect();
    this.floatingTop = headBottom; this.floatingLeft = pageRect.left; this.floatingWidth = pageRect.width;
    this.floating = title.getBoundingClientRect().top <= headBottom + 1;
  };
  constructor(private readonly route: ActivatedRoute, private readonly api: BusinessPlansApiService) {}
  ngOnInit(): void { this.businessId = this.route.snapshot.paramMap.get('businessId') || ''; this.load(); }
  ngAfterViewInit(): void { this.scrollContainer = document.querySelector<HTMLElement>('.workspace-content'); this.scrollContainer?.addEventListener('scroll', this.updateFloating, { passive: true }); window.addEventListener('resize', this.updateFloating, { passive: true }); this.updateFloating(); }
  ngOnDestroy(): void { this.scrollContainer?.removeEventListener('scroll', this.updateFloating); window.removeEventListener('resize', this.updateFloating); }
  load(): void { if (!this.businessId) { this.loading = false; this.loadError = true; return; } this.loading = true; this.loadError = false; this.api.dashboard(this.businessId).subscribe({ next: data => { this.dashboard = data; this.loading = false; }, error: () => { this.loading = false; this.loadError = true; } }); }
  planPurchased(): void { this.planDialog = false; this.success = true; this.load(); }
  creditPurchased(): void { this.creditDialog = false; this.success = true; this.load(); }
  openPromotion(offer: FeaturedBusinessOffer): void { this.promotedPlanId = offer.planId; this.promotedOfferCode = offer.code; this.planDialog = true; }
  buyAgain(): void { this.promotedPlanId = ''; this.promotedOfferCode = ''; this.planDialog = true; }
  formatMoney(value: number): string { return new Intl.NumberFormat(navigator.language || 'en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value); }
  formatDate(value: string): string { return new Intl.DateTimeFormat(navigator.language || 'en-IN', { dateStyle: 'medium' }).format(new Date(value)); }
  get creditCount(): number { return this.dashboard?.extraCredits.length || 0; }
  get canPurchase(): boolean { return Boolean(this.dashboard?.authorization.isOwner || this.dashboard?.authorization.permissionKeys.includes('business.plans.purchase')); }
  get monthLabel(): string { if (!this.dashboard) return ''; const [year, month] = this.dashboard.month.split('-').map(Number); return new Intl.DateTimeFormat(navigator.language || 'en-IN', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1)); }
  get progress(): number { const usage = this.dashboard?.activePlanUsage; return usage?.total ? Math.min(100, usage.used / usage.total * 100) : 0; }
}
