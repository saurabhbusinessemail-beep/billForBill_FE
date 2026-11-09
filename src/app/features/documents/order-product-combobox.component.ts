import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap, timer } from 'rxjs';
import { DocumentsApiService } from './documents-api.service';
import { ProductOption } from './documents.models';

let nextListId = 0;

@Component({
  selector: 'app-order-product-combobox',
  standalone: false,
  template: `
    <input type="text" role="combobox" autocomplete="off" maxlength="160"
      aria-autocomplete="list" [attr.aria-label]="'f015.searchProduct' | translate"
      [attr.aria-expanded]="open() && !!query().trim()" [attr.aria-controls]="open() && query().trim() ? listId : null"
      [attr.aria-activedescendant]="active() < 0 ? null : optionId(active())"
      [placeholder]="'f015.searchProduct' | translate" [value]="open() ? query() : productName"
      (focus)="$any($event.target).select()" (input)="search($any($event.target).value)" (blur)="close()" (keydown)="handleKey($event)">
    @if (open() && query().trim()) {
      <div class="product-combo__menu">
        <ul [id]="listId" role="listbox" [attr.aria-label]="'f015.product' | translate">
          @for (product of results(); track product.id; let index = $index) {
            <li role="option" [id]="optionId(index)" [attr.aria-selected]="active() === index"
              (pointerdown)="$event.preventDefault()" (click)="choose(product)">
              {{ product.name }}<small *ngIf="product.code"> · {{ product.code }}</small>
            </li>
          }
        </ul>
        @if (status()) { <div class="product-combo__status" role="status">{{ status() | translate }}</div> }
      </div>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; position: relative; }
    input { box-sizing: border-box; width: 100%; min-width: 0; padding: .55rem .6rem; border: 1px solid var(--theme-border); border-radius: .55rem; background: var(--theme-surface); color: var(--theme-text); font: inherit; }
    .product-combo__menu { position: absolute; z-index: 2; inset-inline: 0; top: calc(100% + .2rem); overflow: hidden; border: 1px solid var(--theme-border); border-radius: .55rem; background: var(--theme-surface); color: var(--theme-text); box-shadow: 0 .4rem 1rem var(--theme-shadow); }
    ul { margin: 0; padding: 0; max-height: 12rem; overflow-y: auto; list-style: none; }
    li, .product-combo__status { padding: .55rem .65rem; overflow-wrap: anywhere; }
    li { cursor: pointer; }
    li:hover, li[aria-selected="true"] { background: var(--theme-border); }
    small, .product-combo__status { color: var(--theme-text-muted); }
  `,
})
export class OrderProductComboboxComponent {
  @Input({ required: true }) businessId = '';
  @Input() productName = '';
  @Output() readonly productSelected = new EventEmitter<ProductOption>();

  readonly listId = `order-product-options-${++nextListId}`;
  readonly open = signal(false);
  readonly query = signal('');
  readonly results = signal<ProductOption[]>([]);
  readonly status = signal('');
  readonly active = signal(-1);
  private readonly api = inject(DocumentsApiService);
  private readonly searches = new Subject<string>();

  constructor() {
    this.searches.pipe(
      switchMap(query => query ? timer(300).pipe(
        switchMap(() => this.api.searchOrderProducts(this.businessId, query)),
        map(results => ({ results, status: results.length ? '' : 'f015.noProductsMatch' })),
        catchError(() => of({ results: [], status: 'f015.productSearchError' })),
      ) : of({ results: [], status: '' })),
      takeUntilDestroyed(),
    ).subscribe(({ results, status }) => {
      this.results.set(results);
      this.status.set(status);
    });
  }

  optionId(index: number): string { return `${this.listId}-${index}`; }

  search(value: string): void {
    const query = value.trim();
    this.query.set(value);
    this.open.set(true);
    this.active.set(-1);
    this.results.set([]);
    this.searches.next(query);
    if (query) this.status.set('f015.searchingProducts');
  }

  close(): void {
    this.open.set(false);
    this.active.set(-1);
    this.searches.next('');
  }

  choose(product: ProductOption): void {
    this.close();
    this.productSelected.emit(product);
  }

  handleKey(event: KeyboardEvent): void {
    if (!this.open() || event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const results = this.results();
      const product = results.length === 1 ? results[0] : results[this.active()];
      if (product) this.choose(product);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const count = this.results().length;
      if (!count) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const index = this.active() < 0 && step < 0 ? count - 1 : (this.active() + step + count) % count;
      this.active.set(index);
      document.getElementById(this.optionId(index))?.scrollIntoView({ block: 'nearest' });
    }
  }
}
