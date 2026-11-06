import { Component, EventEmitter, Input, Output, OnChanges, inject } from '@angular/core';
import { LanguageService } from '../../../core/language/language.service';
import { WorkspaceService } from '../workspace.service';
import { Workspace } from '../workspace.models';
import { Router } from '@angular/router';
import { BusinessAdminService } from '../../people/business-admin.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-workspace-menu', standalone: false,
  templateUrl: './workspace-menu.component.html', styleUrl: './workspace-menu.component.scss',
})
export class WorkspaceMenuComponent implements OnChanges {
  @Input() myBusinesses: Workspace[] = [];
  @Input() workingAtBusinesses: Workspace[] = [];
  @Input() workingAtLoading = false;
  @Input() workingAtError = false;
  @Input() selectedWorkspaceId = 'personal';
  @Input() isOpen = false;
  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly select = new EventEmitter<string>();
  @Output() readonly addBusiness = new EventEmitter<void>();
  @Output() readonly retryWorkingAt = new EventEmitter<void>();
  readonly languageService = inject(LanguageService);
  readonly workspaceService = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly businessAdmin = inject(BusinessAdminService);
  readonly auth = inject(AuthService);
  readonly catalogKinds = ['products', 'categories', 'attributes', 'units', 'taxes'];
  catalogAllowed = false;
  pricingAllowed = false;
  ordersAllowed = false;
  leadsAllowed = false;
  inventoryAllowed = false;
  reportsAllowed = false;
  billsAllowed = false;
  paymentsAllowed = false;
  transportAllowed = false;
  plansAllowed = false;
  private authorizationRequest = 0;
  ngOnChanges(): void {
    const business = [...this.myBusinesses, ...this.workingAtBusinesses].find(item => item.id === this.selectedWorkspaceId);
    const request = ++this.authorizationRequest;
    this.catalogAllowed = false;
    this.pricingAllowed = false;
    this.ordersAllowed = false;
    this.leadsAllowed = false;
    this.inventoryAllowed = false; this.reportsAllowed = false; this.billsAllowed = false; this.paymentsAllowed = false; this.transportAllowed = false; this.plansAllowed = false;
    if (business) this.businessAdmin.refreshCatalogAuthorization(business.id).subscribe({ next: result => { if (request !== this.authorizationRequest) return; const keys = new Set(result.permissionKeys); this.catalogAllowed = Boolean(result.isOwner || keys.has('business.catalog.view')); this.pricingAllowed = Boolean(result.isOwner || keys.has('business.pricing.view')); this.ordersAllowed = Boolean(result.isOwner || keys.has('business.orders.view')); this.leadsAllowed = Boolean(result.isOwner || keys.has('business.leads.view')); this.inventoryAllowed = Boolean(result.isOwner || keys.has('business.inventory.view')); this.reportsAllowed = Boolean(result.isOwner || keys.has('business.reports.view')); this.billsAllowed = Boolean(result.isOwner || keys.has('business.bills.view')); this.paymentsAllowed = Boolean(result.isOwner || keys.has('business.payments.view')); this.transportAllowed = Boolean(result.isOwner || keys.has('business.transport.manage')); this.plansAllowed = Boolean(result.isOwner || keys.has('business.plans.view')); }, error: () => { if (request !== this.authorizationRequest) return; this.catalogAllowed = false; this.pricingAllowed = false; this.ordersAllowed = false; this.leadsAllowed = false; this.inventoryAllowed = false; this.reportsAllowed = false; this.billsAllowed = false; this.paymentsAllowed = false; this.transportAllowed = false; this.plansAllowed = false; } });
  }
  get isCompactView(): boolean { return window.innerWidth < 1024; }

  selectWorkspace(workspaceId: string): void {
    this.select.emit(workspaceId);
    if (workspaceId === 'personal') void this.router.navigateByUrl('/dashboard/personal');
    else void this.router.navigateByUrl('/dashboard');
    this.close.emit();
  }

}
