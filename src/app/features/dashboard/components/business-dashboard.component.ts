import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BusinessAdminService } from '../../people/business-admin.service';
import { Router } from '@angular/router';
import { Workspace } from '../workspace.models';
import { OPENING_BALANCES_PERMISSION } from '../../opening-balances/opening-balances.api';

@Component({
  selector: 'app-business-dashboard', standalone: false,
  templateUrl: './business-dashboard.component.html', styleUrl: './business-dashboard.component.scss',
})
export class BusinessDashboardComponent implements OnChanges {
  @Input({ required: true }) business!: Workspace;
  @Output() readonly editBusiness = new EventEmitter<void>();
  counts: { people: number; teams: number; permissions: number; products?: number; categories?: number; attributes?: number; units?: number; taxes?: number; orderCount?: number | null; leadCount?: number | null; billCount?: number | null; paymentsCount?: number | null; receivable?: string; payable?: string; inTransit?: number } | null = null;
  permissionKeys = new Set<string>();
  readonly openingBalancesPermission = OPENING_BALANCES_PERMISSION;
  permissionDenied = false;
  constructor(private readonly admin: BusinessAdminService, private readonly router: Router) {}
  ngOnChanges(): void {
    this.counts = null;
    this.permissionKeys.clear();
    this.permissionDenied = false;
    const businessId = this.business.id;
    this.admin.overview(businessId).subscribe({
      next: value => {
        if (businessId !== this.business.id) return;
        this.counts = value.counts; this.permissionKeys = new Set(value.authorization?.permissionKeys || []);
      },
      error: (error: HttpErrorResponse) => {
        if (businessId !== this.business.id) return;
        this.counts = null;
        this.permissionDenied = error.status === 403;
      },
    });
  }
  open(path: string): void { void this.router.navigate(['/dashboard', this.business.id, ...path.split('/').filter(Boolean)]); }
}
