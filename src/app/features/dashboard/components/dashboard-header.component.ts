import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';
import { ThemeService } from '../../../core/theme/theme.service';
import { Workspace } from '../workspace.models';
import { WorkspaceService } from '../workspace.service';
import { Observable } from 'rxjs';
import { SafeUrl } from '@angular/platform-browser';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard-header', standalone: false,
  templateUrl: './dashboard-header.component.html', styleUrl: './dashboard-header.component.scss',
})
export class DashboardHeaderComponent {
  @Input() workspace: Workspace | null = null;
  @Input() isSigningOut = false;
  @Input() errorKey = '';
  @Output() readonly menuToggle = new EventEmitter<void>();
  @Output() readonly signOut = new EventEmitter<void>();
  readonly themeService = inject(ThemeService);
  readonly workspaceService = inject(WorkspaceService);
  readonly authService = inject(AuthService);
  profileMenuOpen = false;
  get businessLogo(): Observable<SafeUrl> | null {
    const workspace = this.workspace;
    return workspace?.kind === 'business' && workspace.hasLogo && !workspace.workingAt
      ? this.workspaceService.businessLogoUrl(workspace.id)
      : null;
  }

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  toggleTheme(): void { this.themeService.toggleTheme(); }
  toggleProfileMenu(): void { this.profileMenuOpen = !this.profileMenuOpen; }
  signOutNow(): void { this.profileMenuOpen = false; this.signOut.emit(); }

  @HostListener('document:click', ['$event'])
  closeProfileMenuFromOutside(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) this.profileMenuOpen = false;
  }

  @HostListener('document:keydown.escape')
  closeProfileMenuOnEscape(): void { this.profileMenuOpen = false; }
}
