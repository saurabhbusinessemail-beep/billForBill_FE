import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-no-data-card', standalone: false,
  templateUrl: './no-data-card.component.html', styleUrl: './no-data-card.component.scss',
})
export class NoDataCardComponent {
  @Input() workspaceName = '';
}
