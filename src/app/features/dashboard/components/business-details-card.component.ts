import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { BalancePeriod, OpeningBalancesApi } from '../../opening-balances/opening-balances.api';
import { Workspace } from '../workspace.models';
import { WorkspaceService } from '../workspace.service';

@Component({
  selector: 'app-business-details-card', standalone: false,
  templateUrl: './business-details-card.component.html', styleUrl: './business-details-card.component.scss',
})
export class BusinessDetailsCardComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) business!: Workspace;
  @Input() canManageOpeningBalance = false;
  @Output() readonly edit = new EventEmitter<void>();
  isCompactView = window.innerWidth < 1024;
  detailsExpanded = false;
  latestBalance: BalancePeriod | null = null;
  balanceLoadError = false;
  private balanceRequest?: Subscription;

  constructor(readonly workspaceService: WorkspaceService, private readonly balances: OpeningBalancesApi) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['business']) this.detailsExpanded = false;
    if (changes['business'] || changes['canManageOpeningBalance']) {
      this.latestBalance = null;
      this.loadOpeningBalance();
    }
  }

  ngOnDestroy(): void { this.balanceRequest?.unsubscribe(); }

  loadOpeningBalance(): void {
    this.balanceRequest?.unsubscribe();
    this.balanceLoadError = false;
    if (!this.canManageOpeningBalance) return;
    this.balanceRequest = this.balances.latest(this.business.id).subscribe({
      next: value => { this.latestBalance = value.period ?? null; },
      error: () => { this.balanceLoadError = true; },
    });
  }

  toggleDetails(): void { this.detailsExpanded = !this.detailsExpanded; }

  @HostListener('window:resize')
  updateCompactView(): void { this.isCompactView = window.innerWidth < 1024; }
}
