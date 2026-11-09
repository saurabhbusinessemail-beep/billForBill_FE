import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';
import { COUNTRY_CODES } from '../../shared/phone/country-codes';
import { formatPhoneE164, parsePhoneE164 } from '../../shared/phone/phone.models';
import { BusinessAdminService } from './business-admin.service';
import { Person } from './people.models';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { DialogService } from '../../shared/dialogs/dialog.service';
import { WorkspaceService } from '../dashboard/workspace.service';
@Component({ selector: 'app-people-page', standalone: false, templateUrl: './people-page.component.html', styleUrl: './people-page.component.scss' })
export class PeoplePageComponent implements OnInit, AfterViewInit, OnDestroy {
  businessId = ''; people: Person[] = []; loading = true; saving = false; errorKey = ''; search = ''; page = 1; total = 0; hasNextPage = false;
  dialog = false; countryRegion = 'US'; phone = ''; name = ''; lookupState: 'idle' | 'existing' | 'new' | 'already' = 'idle';
  canAdd = false; canRemove = false;
  private readonly searchChanges = new Subject<string>();
  private requestVersion = 0;
  floatingHeading = false; floatingTop = 0; floatingLeft = 0; floatingWidth = 0;
  floatingSearchOpen = false; floatingSearchTop = 0;
  private scrollContainer: HTMLElement | null = null;
  private readonly updateFloatingHeading = (): void => {
    const title = document.getElementById('people-title');
    const dashboardHeader = document.querySelector<HTMLElement>('app-dashboard-header');
    if (!title || !dashboardHeader || !this.scrollContainer) return;
    const headerRect = dashboardHeader.getBoundingClientRect();
    this.floatingTop = headerRect.bottom; this.floatingLeft = headerRect.left; this.floatingWidth = headerRect.width;
    const wasFloating = this.floatingHeading;
    this.floatingHeading = title.getBoundingClientRect().top <= headerRect.bottom + 1 || this.floatingSearchOpen;
    if (this.floatingHeading && !wasFloating) window.requestAnimationFrame(this.updateFloatingHeading);
  };
  readonly countries = COUNTRY_CODES;
  get callingCode(): string { return this.countries.find(c => c.region === this.countryRegion)?.code || '+1'; }
  constructor(private route: ActivatedRoute, private api: BusinessAdminService, private auth: AuthService, private dialogs: DialogService, private workspaces: WorkspaceService) {}
  ngOnInit(): void { this.businessId = this.businessParam(); const code = parsePhoneE164(this.auth.currentUser()?.phoneE164)?.countryCallingCode || '+1'; this.countryRegion = this.countries.find(c => c.code === code)?.region || 'US'; this.searchChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => { this.page = 1; this.load(true); }); this.load(); }
  ngAfterViewInit(): void { this.scrollContainer = document.querySelector<HTMLElement>('.workspace-content'); this.scrollContainer?.addEventListener('scroll', this.updateFloatingHeading, { passive: true }); window.addEventListener('resize', this.updateFloatingHeading, { passive: true }); this.updateFloatingHeading(); }
  ngOnDestroy(): void { this.scrollContainer?.removeEventListener('scroll', this.updateFloatingHeading); window.removeEventListener('resize', this.updateFloatingHeading); this.searchChanges.complete(); }
  load(preserveContent = false): void { const version = ++this.requestVersion; if (!preserveContent) this.loading = true; this.errorKey = ''; this.api.people(this.businessId, this.search, this.page).subscribe({ next: r => { if (version !== this.requestVersion) return; this.people = r.items; this.total = r.total; this.hasNextPage = r.hasNextPage; this.canAdd = Boolean(r.authorization?.isOwner || r.authorization?.permissionKeys.includes('people.add')); this.canRemove = Boolean(r.authorization?.isOwner || r.authorization?.permissionKeys.includes('people.remove')); this.loading = false; }, error: () => { if (version !== this.requestVersion) return; this.errorKey = 'f006.loadPeopleError'; this.loading = false; } }); }
  searchChanged(): void { this.requestVersion++; this.searchChanges.next(this.search); }
  toggleFloatingSearch(event: MouseEvent): void { this.floatingSearchOpen = !this.floatingSearchOpen; if (this.floatingSearchOpen) this.floatingSearchTop = (event.currentTarget as HTMLElement).getBoundingClientRect().bottom + 6; else window.requestAnimationFrame(this.updateFloatingHeading); }
  @HostListener('document:keydown.escape') closeOverlaysOnEscape(): void {
    if (this.floatingSearchOpen) { this.floatingSearchOpen = false; window.requestAnimationFrame(this.updateFloatingHeading); }
  }
  @HostListener('document:click', ['$event']) closeOverlaysOnOutsideClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;

    if (this.floatingSearchOpen && !target?.closest('.people-floating-search-menu, .people-floating-search-action')) { this.floatingSearchOpen = false; window.requestAnimationFrame(this.updateFloatingHeading); }
  }
  changePage(page: number): void { if (page < 1 || (page > this.page && !this.hasNextPage)) return; this.page = page; this.load(); }
  openAdd(): void { this.dialog = true; this.name = ''; this.phone = ''; this.lookupState = 'idle'; this.errorKey = ''; }
  close(): void { if (!this.saving) this.dialog = false; }
  checkPhone(): void { this.errorKey = ''; this.lookupState = 'idle'; this.name = ''; if (!this.phone.trim()) return; this.api.lookup(this.businessId, { countryCallingCode: this.callingCode, phoneNumber: this.phone }).subscribe({ next: result => { if (result.exists && result.alreadyAdded) { this.lookupState = 'already'; this.name = result.user?.name || ''; } else if (result.exists) { this.lookupState = 'existing'; this.name = result.user?.name || ''; } else this.lookupState = 'new'; }, error: (e: HttpErrorResponse) => { this.errorKey = e.error?.error?.code === 'INVALID_PHONE' ? 'f006.invalidPhone' : 'f006.lookupError'; } }); }
  add(): void { if (this.saving) return; this.saving = true; this.errorKey = ''; this.api.addPerson(this.businessId, { countryCallingCode: this.callingCode, phoneNumber: this.phone, ...(this.lookupState === 'new' ? { name: this.name.trim() } : {}) }).subscribe({ next: () => { this.saving = false; this.dialog = false; this.api.invalidate(this.businessId); this.load(); }, error: e => { this.saving = false; this.errorKey = e.error?.error?.code === 'PERSON_EXISTS' ? 'f006.personExists' : e.error?.error?.code === 'NAME_REQUIRED' ? 'f006.nameRequired' : 'f006.savePersonError'; } }); }
  async remove(person: Person): Promise<void> { const businessName = this.workspaces.workspaces().find(workspace => workspace.id === this.businessId)?.name || ''; const confirmed = await this.dialogs.confirm({ titleKey: 'f006.removePersonTitle', titleParams: { name: person.name }, messageKey: 'f006.removePersonMessage', messageParams: { businessName }, confirmKey: 'f006.removeMember' }); if (!confirmed) return; this.api.removePerson(this.businessId, person.userId).subscribe({ next: () => this.load(), error: () => this.errorKey = 'f006.removeError' }); }
  initials(p: Person): string { return p.generatedNameNumber ? `U${p.generatedNameNumber}` : p.name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase(); }
  avatar(p: Person): string { return p.photoUrl || ''; }
  formatPhone(e164: string): string { return formatPhoneE164(e164); }
  private businessParam(): string { let current: ActivatedRoute | null = this.route; while (current) { const id = current.snapshot.paramMap.get('businessId'); if (id) return id; current = current.parent; } return ''; }
}
