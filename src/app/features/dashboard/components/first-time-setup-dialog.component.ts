import { Component, EventEmitter, Input, Output } from '@angular/core';
import { WorkspaceSetupChoice } from '../workspace.models';

@Component({
  selector: 'app-first-time-setup-dialog', standalone: false,
  templateUrl: './first-time-setup-dialog.component.html', styleUrl: './first-time-setup-dialog.component.scss',
})
export class FirstTimeSetupDialogComponent {
  @Input() isSaving = false;
  @Input() errorKey = '';
  @Output() readonly choose = new EventEmitter<WorkspaceSetupChoice>();

  blockEscape(event: KeyboardEvent): void {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
  }
}
