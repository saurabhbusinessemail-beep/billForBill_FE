import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { DialogService } from '../../shared/dialogs/dialog.service';
import { BusinessDetails, Workspace, WorkspaceOverview, WorkspaceSetupChoice } from './workspace.models';
import { WorkspaceService } from './workspace.service';

@Component({
  selector: 'app-dashboard', standalone: false, templateUrl: './dashboard.component.html', styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly dialogs = inject(DialogService);
  isLoading = true;
  isLoggingOut = false;
  isSavingSetupChoice = false;
  isSavingBusiness = false;
  isMenuOpen = false;
  isBusinessDialogOpen = false;
  isFirstTimeBusinessDialog = false;
  setupChoice: WorkspaceSetupChoice | null = null;
  setupErrorKey = '';
  dashboardErrorKey = '';
  headerErrorKey = '';
  businessErrorKey = '';
  editingBusiness: Workspace | null = null;
  private createdBusinessInDialog = false;

  constructor(readonly auth: AuthService, readonly workspaceService: WorkspaceService, private readonly router: Router, private readonly route: ActivatedRoute) {}
  get isBusinessChildRoute(): boolean {
    const child = this.route.firstChild;
    if (!child) return false;
    return child.snapshot.routeConfig?.path?.startsWith('admin-setup/') === true || Boolean(child.firstChild);
  }
  get workspaces(): Workspace[] { return this.workspaceService.workspaces(); }
  get activeWorkspace(): Workspace | null {
    return this.workspaces.find((workspace) => workspace.id === this.workspaceService.activeWorkspaceId()) ?? null;
  }

  ngOnInit(): void {
    this.loadWorkspaces();
    this.route.firstChild?.paramMap.subscribe(params => { const businessId = params.get('businessId'); if (businessId) this.workspaceService.selectWorkspace(businessId); });
  }

  loadWorkspaces(): void {
    this.isLoading = true;
    this.dashboardErrorKey = '';
    this.workspaceService.loadWorkspaces().subscribe({
      next: (overview: WorkspaceOverview) => {
        this.setupChoice = overview.setupChoice;
        const businessId = this.route.firstChild?.snapshot.paramMap.get('businessId');
        if (businessId) this.workspaceService.selectWorkspace(businessId);
        else if (this.route.firstChild?.snapshot.routeConfig?.path === 'personal') this.workspaceService.selectWorkspace('personal');
        this.isLoading = false;
        if (!this.route.firstChild && this.activeWorkspace?.kind === 'personal') void this.router.navigateByUrl('/dashboard/personal', { replaceUrl: true });
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        if (error.status === 401) { void this.router.navigateByUrl('/login'); return; }
        this.dashboardErrorKey = 'dashboard.loadError';
      },
    });
  }

  chooseSetup(choice: WorkspaceSetupChoice): void {
    if (this.isSavingSetupChoice) return;
    this.isSavingSetupChoice = true;
    this.setupErrorKey = '';
    this.workspaceService.saveSetupChoice(choice).subscribe({
      next: (savedChoice) => {
        this.setupChoice = savedChoice;
        this.isSavingSetupChoice = false;
        if (savedChoice === 'personal') {
          this.workspaceService.selectWorkspace('personal');
          void this.router.navigateByUrl('/dashboard/personal');
          return;
        }
        this.isFirstTimeBusinessDialog = true;
        this.editingBusiness = null;
        this.businessErrorKey = '';
        this.isBusinessDialogOpen = true;
      },
      error: (error: HttpErrorResponse) => {
        this.isSavingSetupChoice = false;
        this.setupErrorKey = error.status === 401 ? 'dashboard.loadError' : 'onboarding.saveError';
        if (error.status === 401) void this.router.navigateByUrl('/login');
      },
    });
  }

  selectWorkspace(workspaceId: string): void { this.workspaceService.selectWorkspace(workspaceId); }
  retryWorkingAt(): void { this.workspaceService.retryWorkingAt().subscribe({ error: () => undefined }); }
  addBusiness(): void { this.openBusinessDialog(null, false); }
  editBusiness(): void {
    if (this.activeWorkspace?.kind === 'business') this.openBusinessDialog(this.activeWorkspace, false);
  }

  cancelBusinessDialog(): void {
    this.isBusinessDialogOpen = false;
    this.businessErrorKey = '';
    if (this.isFirstTimeBusinessDialog) this.workspaceService.selectWorkspace('personal');
    this.isFirstTimeBusinessDialog = false;
    this.editingBusiness = null;
    this.createdBusinessInDialog = false;
  }

  saveBusiness(event: { details: BusinessDetails; logo: File | null; removeLogo: boolean; creationRequestKey: string }): void {
    if (this.isSavingBusiness) return;
    this.isSavingBusiness = true;
    this.businessErrorKey = '';
    const existingBusiness = this.editingBusiness;
    const request = existingBusiness
      ? this.workspaceService.updateBusiness(existingBusiness.id, event.details)
      : this.workspaceService.createBusiness(event.details, event.creationRequestKey);
    request.subscribe({
      next: (business) => {
        if (!existingBusiness) this.createdBusinessInDialog = true;
        this.editingBusiness = business;
        this.saveBusinessLogoChanges(business, event);
      },
      error: (error: HttpErrorResponse) => {
        this.isSavingBusiness = false;
        this.businessErrorKey = this.businessErrorKeyFor(error);
        if (this.businessErrorKey === 'business.gstinAlreadyInUse') {
          void this.dialogs.alert({ titleKey: 'business.gstin', messageKey: this.businessErrorKey });
        }
      },
    });
  }

  private saveBusinessLogoChanges(business: Workspace, event: { details: BusinessDetails; logo: File | null; removeLogo: boolean }): void {
    let logoRequest: Observable<void> | undefined;
    if (event.logo) logoRequest = this.workspaceService.uploadLogo(business.id, event.logo);
    else if (event.removeLogo && business.hasLogo) logoRequest = this.workspaceService.deleteLogo(business.id);
    if (!logoRequest) { this.finishBusinessSave(business); return; }
    logoRequest.subscribe({
      next: () => this.finishBusinessSave({ ...business, hasLogo: Boolean(event.logo) }),
      error: () => {
        this.isSavingBusiness = false;
        this.businessErrorKey = 'business.logoSaveError';
        this.workspaceService.addOrUpdateWorkspace(business);
      },
    });
  }

  private finishBusinessSave(business: Workspace): void {
    this.workspaceService.addOrUpdateWorkspace(business);
    this.workspaceService.selectWorkspace(business.id);
    this.isSavingBusiness = false;
    this.isBusinessDialogOpen = false;
    this.isFirstTimeBusinessDialog = false;
    this.editingBusiness = null;
    this.businessErrorKey = '';
    if (this.createdBusinessInDialog) {
      this.createdBusinessInDialog = false;
      void this.router.navigateByUrl('/dashboard');
    }
  }

  private businessErrorKeyFor(error: HttpErrorResponse): string {
    const code = error.error?.error?.code;
    if (code === 'INVALID_BUSINESS_EMAIL') return 'business.invalidEmail';
    if (code === 'INVALID_GSTIN') return 'business.invalidGstin';
    if (code === 'GSTIN_ALREADY_IN_USE') return 'business.gstinAlreadyInUse';
    if (code === 'INVALID_BUSINESS_WEBSITE') return 'business.invalidWebsite';
    if (code === 'LOGO_TOO_LARGE' || error.status === 413) return 'business.logoTooLarge';
    if (code === 'UNSUPPORTED_LOGO_TYPE' || code === 'INVALID_LOGO_CONTENT') return 'business.logoInvalid';
    if (code === 'BUSINESS_TYPE_CATALOG_INCOMPLETE' || code === 'CATALOG_COPY_COMPENSATION_FAILED' || code === 'CATALOG_COPY_INCOMPLETE') return 'f009.catalogCopyError';
    return 'business.saveError';
  }

  private openBusinessDialog(business: Workspace | null, isFirstTime: boolean): void {
    this.editingBusiness = business ? { ...business } : null;
    this.isFirstTimeBusinessDialog = isFirstTime;
    this.businessErrorKey = '';
    this.isBusinessDialogOpen = true;
  }

  logout(): void {
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;
    this.headerErrorKey = '';
    this.auth.logout().subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: (error: HttpErrorResponse) => {
        this.isLoggingOut = false;
        if (error.status === 401) { void this.router.navigateByUrl('/login'); return; }
        this.headerErrorKey = 'dashboard.signOutError';
      },
    });
  }
}
