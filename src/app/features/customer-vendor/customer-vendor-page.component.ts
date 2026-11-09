import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription, switchMap, timer } from 'rxjs';
import { SharedModule } from '../../shared/shared.module';
import { OpeningBalanceDialogComponent } from '../opening-balances/opening-balance-dialog.component';
import { DirectoryParty, OpeningBalancesApi } from '../opening-balances/opening-balances.api';

@Component({
  selector: 'app-customer-vendor-page',
  imports: [FormsModule, SharedModule, OpeningBalanceDialogComponent],
  templateUrl: './customer-vendor-page.component.html',
  styleUrls: ['../people/people-page.component.scss', './customer-vendor-page.component.scss'],
})
export class CustomerVendorPageComponent implements OnInit, AfterViewInit, OnDestroy {
  businessId = '';
  search = '';
  parties: DirectoryParty[] = [];
  total = 0;
  currency = 'INR';
  canManage = false;
  loading = true;
  errorKey = '';
  page = 1;
  nextCursor: string | null = null;
  private cursors = [''];
  private routeChanges?: Subscription;
  private request?: Subscription;
  private scrollContainer?: HTMLElement;
  floatingHeading = false;
  floatingTop = 0;
  floatingLeft = 0;
  floatingWidth = 0;
  floatingSearchOpen = false;
  floatingSearchTop = 0;

  constructor(private readonly route: ActivatedRoute, private readonly api: OpeningBalancesApi) {}

  ngOnInit(): void {
    this.routeChanges = (this.route.parent?.paramMap ?? this.route.paramMap).subscribe(params => {
      this.businessId = params.get('businessId') || '';
      this.search = '';
      this.parties = [];
      this.total = 0;
      this.canManage = false;
      this.resetPage();
      this.load();
    });
  }

  ngAfterViewInit(): void {
    this.scrollContainer = document.querySelector<HTMLElement>('.workspace-content') ?? undefined;
    this.scrollContainer?.addEventListener('scroll', this.updateHeading, { passive: true });
    window.addEventListener('resize', this.updateHeading, { passive: true });
    this.updateHeading();
  }

  ngOnDestroy(): void {
    this.routeChanges?.unsubscribe();
    this.request?.unsubscribe();
    this.scrollContainer?.removeEventListener('scroll', this.updateHeading);
    window.removeEventListener('resize', this.updateHeading);
  }

  private readonly updateHeading = (): void => {
    const title = document.getElementById('customer-vendor-title');
    const header = document.querySelector('app-dashboard-header');
    if (!title || !header) return;
    const rect = header.getBoundingClientRect();
    this.floatingTop = rect.bottom;
    this.floatingLeft = rect.left;
    this.floatingWidth = rect.width;
    this.floatingHeading = this.floatingSearchOpen || title.getBoundingClientRect().top <= rect.bottom + 1;
  };

  toggleSearch(trigger: HTMLButtonElement): void {
    this.floatingSearchOpen = !this.floatingSearchOpen;
    this.floatingSearchTop = trigger.getBoundingClientRect().bottom + 6;
    this.updateHeading();
  }

  @HostListener('document:keydown.escape')
  closeSearch(): void {
    if (!this.floatingSearchOpen) return;
    this.floatingSearchOpen = false;
    this.updateHeading();
  }

  @HostListener('document:click', ['$event'])
  closeSearchOutside(event: MouseEvent): void {
    if (!(event.target as HTMLElement | null)?.closest('.people-floating-search-menu, .people-floating-search-action')) {
      this.closeSearch();
    }
  }

  searchChanged(value: string): void {
    this.search = value;
    this.resetPage();
    this.load(300);
  }

  changePage(direction: -1 | 1): void {
    if (this.loading || (direction === -1 ? this.page === 1 : !this.nextCursor)) return;
    if (direction === 1 && this.nextCursor) this.cursors[this.page] = this.nextCursor;
    this.page += direction;
    this.load();
  }

  private resetPage(): void {
    this.page = 1;
    this.cursors = [''];
    this.nextCursor = null;
  }

  load(delay = 0): void {
    this.request?.unsubscribe();
    this.loading = true;
    this.errorKey = '';
    this.request = timer(delay).pipe(switchMap(() =>
      this.api.directory(this.businessId, this.search.trim(), this.cursors[this.page - 1])
    )).subscribe({
      next: value => {
        this.parties = value.items;
        this.total = value.total;
        this.currency = value.currency;
        this.canManage = value.canManage;
        this.nextCursor = value.nextCursor;
        this.loading = false;
      },
      error: (error: HttpErrorResponse) => {
        if (this.page > 1 && error.error?.error?.code === 'STALE_REPORT_CURSOR') {
          this.resetPage();
          this.load();
          return;
        }
        this.parties = [];
        this.loading = false;
        this.errorKey = error.status === 403 ? 'f016.forbidden' : 'f029.directoryError';
      },
    });
  }

  initials(party: DirectoryParty): string {
    return party.label.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '•';
  }
}
