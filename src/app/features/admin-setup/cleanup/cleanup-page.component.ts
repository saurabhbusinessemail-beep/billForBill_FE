import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { DialogService } from '../../../shared/dialogs/dialog.service';
import { CleanupApiService, CleanupBusiness, CleanupScope } from './cleanup-api.service';
@Component({ selector: 'app-cleanup-page', standalone: false, templateUrl: './cleanup-page.component.html', styleUrls: ['./cleanup-page.component.scss'] })
export class CleanupPageComponent implements OnInit, AfterViewInit, OnDestroy {
  businesses: CleanupBusiness[] = []; page = 1; totalPages = 1; total = 0; search = '';
  loading = false; loadError = false; pending = false; busy = false; activeAction = ''; errorKey = ''; successKey = ''; completedName = '';
  floating = false; top = 0; left = 0; width = 0;
  private scroller: HTMLElement | null = null;
  private headerObserver?: ResizeObserver;
  private listRequest?: Subscription;
  private destroyed = false;
  private readonly updateHeading = (): void => {
    const title = document.getElementById('cleanup-title');
    const header = document.querySelector<HTMLElement>('app-dashboard-header');
    if (!title || !header) return;
    const bounds = header.getBoundingClientRect();
    this.top = bounds.bottom; this.left = bounds.left; this.width = bounds.width;
    this.floating = title.getBoundingClientRect().top <= bounds.bottom;
  };
  constructor(readonly auth: AuthService, private readonly api: CleanupApiService, private readonly dialog: DialogService) {}
  ngOnInit(): void { this.load(); }
  ngAfterViewInit(): void {
    this.scroller = document.querySelector<HTMLElement>('.workspace-content');
    this.scroller?.addEventListener('scroll', this.updateHeading, { passive: true });
    window.addEventListener('resize', this.updateHeading, { passive: true });
    const header = document.querySelector<HTMLElement>('app-dashboard-header');
    if (header) { this.headerObserver = new ResizeObserver(this.updateHeading); this.headerObserver.observe(header); }
    this.updateHeading();
  }
  ngOnDestroy(): void { this.destroyed = true; this.listRequest?.unsubscribe(); this.scroller?.removeEventListener('scroll', this.updateHeading); window.removeEventListener('resize', this.updateHeading); this.headerObserver?.disconnect(); if (this.pending) this.dialog.close(false); }
  load(): void {
    this.listRequest?.unsubscribe(); this.loading = true; this.loadError = false;
    this.listRequest = this.api.businesses(this.page, this.search.trim()).subscribe({ next: result => { this.businesses = result.items; this.total = result.total; this.totalPages = result.totalPages; this.loading = false; }, error: () => { this.loading = false; this.loadError = true; } });
  }
  searchBusinesses(): void { this.page = 1; this.load(); }
  changePage(delta: number): void { this.page = Math.max(1, Math.min(this.totalPages, this.page + delta)); this.load(); }
  async clean(scope: CleanupScope, business?: CleanupBusiness): Promise<void> {
    if (this.busy || this.pending || this.auth.currentUser()?.isSuperAdmin !== true) return;
    this.pending = true;
    const confirmed = await this.dialog.confirm({ titleKey: 'f027.confirmTitle', messageKey: scope === 'business' ? 'f027.confirmBusiness' : scope === 'all' ? 'f027.confirmAll' : 'f027.confirmAdmin', messageParams: { name: business?.name || '' }, confirmKey: 'f027.clean', confirmStyle: 'danger' });
    this.pending = false;
    if (!confirmed || this.destroyed) return;
    this.busy = true; this.activeAction = business?.id || scope; this.errorKey = ''; this.successKey = '';
    // Keep the request subscribed across navigation: an accepted cleanup continues on the server.
    this.api.clean(scope, business?.id).subscribe({ next: () => { this.busy = false; this.completedName = business?.name || ''; this.successKey = scope === 'business' ? 'f027.businessDone' : scope === 'all' ? 'f027.allDone' : 'f027.adminDone'; }, error: (error: HttpErrorResponse) => {
      this.busy = false;
      const code = error.error?.error?.code;
      this.errorKey = code === 'CLEANUP_INCOMPLETE' ? 'f027.partial' : code === 'PRICING_JOB_IN_PROGRESS' ? 'f027.jobBusy' : code === 'CLEANUP_IN_PROGRESS' ? 'f027.busyError' : error.status === 401 || error.status === 403 ? 'f027.denied' : 'f027.failed';
    } });
  }
}
