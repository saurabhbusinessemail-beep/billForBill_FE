import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BusinessAdminService } from '../people/business-admin.service';
import { DialogService } from '../../shared/dialogs/dialog.service';
import { Team, TeamMemberPreview } from '../people/people.models';
@Component({ selector: 'app-teams-page', standalone: false, templateUrl: './teams-page.component.html', styleUrl: './teams-page.component.scss' })
export class TeamsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  businessId = ''; teams: Team[] = []; loading = true; errorKey = ''; dialog = false; saving = false; editId = ''; name = ''; description = '';
  canCreate = false; canUpdate = false; canDelete = false; canView = false;
  floatingHeading = false; floatingTop = 0; floatingLeft = 0; floatingWidth = 0;
  private scrollContainer: HTMLElement | null = null;
  private readonly updateFloatingHeading = (): void => {
    const title = document.getElementById('teams-title');
    const dashboardHeader = document.querySelector<HTMLElement>('app-dashboard-header');
    if (!title || !dashboardHeader || !this.scrollContainer) return;
    const headerRect = dashboardHeader.getBoundingClientRect();
    this.floatingTop = headerRect.bottom; this.floatingLeft = headerRect.left; this.floatingWidth = headerRect.width;
    const wasFloating = this.floatingHeading;
    this.floatingHeading = title.getBoundingClientRect().top <= headerRect.bottom + 1;
    if (this.floatingHeading && !wasFloating) window.requestAnimationFrame(this.updateFloatingHeading);
  };
  constructor(private route: ActivatedRoute, private router: Router, private api: BusinessAdminService, private dialogs: DialogService) {}
  ngOnInit(): void { this.businessId = this.businessParam(); this.load(); }
  ngAfterViewInit(): void { this.scrollContainer = document.querySelector<HTMLElement>('.workspace-content'); this.scrollContainer?.addEventListener('scroll', this.updateFloatingHeading, { passive: true }); window.addEventListener('resize', this.updateFloatingHeading, { passive: true }); this.updateFloatingHeading(); }
  ngOnDestroy(): void { this.scrollContainer?.removeEventListener('scroll', this.updateFloatingHeading); window.removeEventListener('resize', this.updateFloatingHeading); }
  load(): void { this.loading = true; this.api.teams(this.businessId).subscribe({ next: r => { this.teams = r.items; const auth = r.authorization; this.canCreate = Boolean(auth?.isOwner || auth?.permissionKeys.includes('teams.create')); this.canUpdate = Boolean(auth?.isOwner || auth?.permissionKeys.includes('teams.update')); this.canDelete = Boolean(auth?.isOwner || auth?.permissionKeys.includes('teams.remove')); this.canView = Boolean(auth?.isOwner || auth?.permissionKeys.includes('teams.view')); this.loading = false; }, error: () => { this.errorKey = 'f006.loadTeamsError'; this.loading = false; } }); }
  open(team?: Team): void { this.editId = team?.id || ''; this.name = team?.name || ''; this.description = team?.description || ''; this.dialog = true; this.errorKey = ''; }
  save(): void { if (!this.name.trim() || this.saving) return; this.saving = true; this.api.saveTeam(this.businessId, { id: this.editId || undefined, name: this.name, description: this.description }).subscribe({ next: () => { this.saving = false; this.dialog = false; this.load(); }, error: e => { this.saving = false; this.errorKey = e.error?.error?.code === 'TEAM_NAME_EXISTS' ? 'f006.teamExists' : 'f006.saveTeamError'; } }); }
  async remove(t: Team): Promise<void> { const confirmed = await this.dialogs.confirm({ titleKey: 'f006.deleteTeamTitle', titleParams: { name: t.name }, messageKey: 'f006.deleteTeamMessage', confirmKey: 'f006.deleteTeam' }); if (!confirmed) return; this.api.deleteTeam(this.businessId, t.id).subscribe({ next: () => this.load(), error: () => this.errorKey = 'f006.removeTeamError' }); }
  manage(t: Team): void { void this.router.navigate(['/dashboard', this.businessId, 'teams', t.id]); }
  memberInitials(member: TeamMemberPreview): string { return member.generatedNameNumber ? `U${member.generatedNameNumber}` : member.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
  private businessParam(): string { let current: ActivatedRoute | null = this.route; while (current) { const id = current.snapshot.paramMap.get('businessId'); if (id) return id; current = current.parent; } return ''; }
}
