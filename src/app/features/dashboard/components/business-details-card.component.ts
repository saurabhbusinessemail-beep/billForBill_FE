import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Workspace } from '../workspace.models';
import { WorkspaceService } from '../workspace.service';

@Component({
  selector: 'app-business-details-card', standalone: false,
  templateUrl: './business-details-card.component.html', styleUrl: './business-details-card.component.scss',
})
export class BusinessDetailsCardComponent implements OnChanges {
  @Input({ required: true }) business!: Workspace;
  @Output() readonly edit = new EventEmitter<void>();
  isCompactView = window.innerWidth < 1024;
  detailsExpanded = false;

  constructor(readonly workspaceService: WorkspaceService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['business']) this.detailsExpanded = false;
  }

  toggleDetails(): void { this.detailsExpanded = !this.detailsExpanded; }

  @HostListener('window:resize')
  updateCompactView(): void { this.isCompactView = window.innerWidth < 1024; }
}
