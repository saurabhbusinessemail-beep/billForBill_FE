import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BusinessAdminService } from '../people/business-admin.service';
import { DialogService } from '../../shared/dialogs/dialog.service';
import { formatPhoneE164 } from '../../shared/phone/phone.models';
import { Permission, Person, Team } from '../people/people.models';
@Component({ selector: 'app-team-manage', standalone: false, templateUrl: './team-manage.component.html', styleUrl: './team-manage.component.scss' })
export class TeamManageComponent implements OnInit, AfterViewInit, OnDestroy {
  businessId = ''; teamId = ''; team: Team | null = null; members: Person[] = []; eligible: Person[] = []; permissions: Permission[] = []; selected = new Set<string>(); private savedSelection = new Set<string>(); activeTab: 'members' | 'permissions' = 'members'; errorKey = ''; loading = true; saving = false; selectedUserId = '';
  canManageMembers = false; canManagePermissions = false;
  floatingHeading = false; floatingTop = 0; floatingLeft = 0; floatingWidth = 0;
  private scrollContainer: HTMLElement | null = null;
  private readonly updateFloatingHeading = (): void => {
    const title = document.getElementById('team-manage-title');
    const dashboardHeader = document.querySelector<HTMLElement>('app-dashboard-header');
    if (!title || !dashboardHeader || !this.scrollContainer) return;
    const headerRect = dashboardHeader.getBoundingClientRect();
    this.floatingTop = headerRect.bottom; this.floatingLeft = headerRect.left; this.floatingWidth = headerRect.width;
    this.floatingHeading = title.getBoundingClientRect().top <= headerRect.bottom + 1;
  };
  constructor(private route: ActivatedRoute, private router: Router, private api: BusinessAdminService, private dialogs: DialogService) {}
  ngOnInit(): void { this.businessId = this.businessParam(); this.teamId = this.route.snapshot.paramMap.get('teamId') || ''; this.load(); }
  ngAfterViewInit(): void { this.scrollContainer = document.querySelector<HTMLElement>('.workspace-content'); this.scrollContainer?.addEventListener('scroll', this.updateFloatingHeading, { passive: true }); window.addEventListener('resize', this.updateFloatingHeading, { passive: true }); this.updateFloatingHeading(); }
  ngOnDestroy(): void { this.scrollContainer?.removeEventListener('scroll', this.updateFloatingHeading); window.removeEventListener('resize', this.updateFloatingHeading); }
  load(): void { this.loading = true; this.api.team(this.businessId, this.teamId).subscribe({ next: t => this.team = t, error: () => this.errorKey = 'f006.loadTeamError' }); this.api.members(this.businessId, this.teamId).subscribe({ next: x => { this.members = x.members; this.eligible = x.eligible; this.canManageMembers = Boolean(x.authorization?.isOwner || x.authorization?.permissionKeys.includes('team.members.manage')); this.loading = false; }, error: () => { this.errorKey = 'f006.loadTeamError'; this.loading = false; } }); this.api.permissions(this.businessId, this.teamId).subscribe({ next: x => { this.permissions = x.permissions; this.selected = new Set(x.permissions.filter(p => p.granted).map(p => p.key)); this.savedSelection = new Set(this.selected); this.canManagePermissions = Boolean(x.authorization?.isOwner || x.authorization?.permissionKeys.includes('team.permissions.manage')); }, error: () => this.errorKey = 'f006.loadTeamError' }); }
  avatar(p: Person): string { return p.photoUrl || ''; }
  formatPhone(phoneE164: string): string { return formatPhoneE164(phoneE164); }
  initials(p: Person): string { return p.generatedNameNumber ? `U${p.generatedNameNumber}` : p.name.trim().split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase(); }
  addMember(): void { if (!this.selectedUserId) return; this.saving = true; this.api.member(this.businessId, this.teamId, this.selectedUserId, true).subscribe({ next: () => { this.saving = false; this.selectedUserId = ''; this.api.invalidate(this.businessId); this.load(); }, error: () => { this.saving = false; this.errorKey = 'f006.memberChangeError'; } }); }
  async removeMember(p: Person): Promise<void> { const confirmed = await this.dialogs.confirm({ titleKey: 'f006.removeFromTeamTitle', titleParams: { name: p.name }, messageKey: 'f006.removeFromTeamMessage', confirmKey: 'f006.removeMember' }); if (!confirmed) return; this.api.member(this.businessId, this.teamId, p.userId, false).subscribe({ next: () => { this.api.invalidate(this.businessId); this.load(); }, error: () => this.errorKey = 'f006.memberChangeError' }); }
  toggle(key: string, checked: boolean): void { const next = new Set(this.selected); checked ? next.add(key) : next.delete(key); this.selected = next; }
  setAllPermissions(granted: boolean): void { this.selected = new Set(granted ? this.permissions.map(permission => permission.key) : []); }
  setReadOnlyPermissions(): void { this.selected = new Set(this.permissions.filter(permission => ['dashboard.view', 'people.view', 'teams.view', 'business.pricing.view', 'business.orders.view', 'business.leads.view', 'business.inventory.view', 'business.reports.view'].includes(permission.key)).map(permission => permission.key)); }
  savePermissions(): void { if (this.saving || !this.permissionsChanged) return; this.saving = true; this.api.setPermissions(this.businessId, this.teamId, [...this.selected]).subscribe({ next: list => { this.permissions = list; this.selected = new Set(list.filter(permission => permission.granted).map(permission => permission.key)); this.savedSelection = new Set(this.selected); this.saving = false; }, error: () => { this.errorKey = 'f006.permissionSaveError'; this.saving = false; } }); }
  back(): void { void this.router.navigate(['/dashboard', this.businessId, 'teams']); }
  byCategory(category: string): Permission[] { return this.permissions.filter(p => p.category === category); }
  selectedInCategory(category: string): number { return this.byCategory(category).filter(permission => this.selected.has(permission.key)).length; }
  get permissionsChanged(): boolean { return this.selected.size !== this.savedSelection.size || [...this.selected].some(key => !this.savedSelection.has(key)); }
  private businessParam(): string { let current: ActivatedRoute | null = this.route; while (current) { const id = current.snapshot.paramMap.get('businessId'); if (id) return id; current = current.parent; } return ''; }
}
