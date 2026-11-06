import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

interface BusinessOption { id: string; name: string; }

@Component({
  selector: 'app-personal-business-combobox',
  standalone: false,
  template: `<div class="business-combo" [class.is-open]="open">
    <div class="business-combo__control">
      <input type="search" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" [disabled]="disabled" [attr.aria-expanded]="open" [attr.aria-controls]="listId" [attr.aria-label]="ariaLabel" [placeholder]="allLabel" [value]="query" (focus)="open=true" (input)="query=$any($event.target).value; open=true" (keydown.arrowdown)="move(1,$any($event))" (keydown.arrowup)="move(-1,$any($event))" (keydown.enter)="chooseActive($any($event))" (keydown.escape)="open=false">
      <button type="button" [disabled]="disabled" [attr.aria-label]="showOptionsLabel" [attr.aria-expanded]="open" (click)="toggle()"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5"></path></svg></button>
    </div>
    <div *ngIf="open" class="business-combo__options" [id]="listId" role="listbox" [attr.aria-label]="ariaLabel">
      <button type="button" role="option" [disabled]="disabled" [attr.aria-selected]="value==='all'" [class.is-selected]="value==='all'" (click)="choose('all',allLabel)">{{ allLabel }}</button>
      <button type="button" role="option" *ngFor="let business of filteredBusinesses; let i=index" [disabled]="disabled" [attr.aria-selected]="value===business.id" [class.is-selected]="value===business.id" [class.is-active]="i===activeIndex" (click)="choose(business.id,business.name)">{{ business.name }}</button>
      <p *ngIf="!filteredBusinesses.length" class="business-combo__empty">{{ noResultsLabel }}</p>
    </div>
  </div>`,
  styles: [`
    :host { display:block; min-width:0; }
    .business-combo { position:relative; min-width:0; }
    .business-combo__control { display:flex; align-items:center; min-width:0; height:2.5rem; overflow:hidden; border:1px solid var(--theme-border); border-radius:.55rem; background:var(--theme-page); }
    .business-combo__control:focus-within { outline:2px solid var(--theme-focus); outline-offset:1px; }
    .business-combo__control input { width:100%; min-width:0; height:100%; padding:.35rem .55rem; border:0; outline:0; background:transparent; color:var(--theme-text); font:inherit; font-size:.78rem; }
    .business-combo__control input::-webkit-search-cancel-button { cursor:pointer; }
    .business-combo__control button { display:grid; flex:0 0 2rem; height:100%; place-items:center; border:0; border-left:1px solid var(--theme-border); background:transparent; color:var(--theme-text-muted); cursor:pointer; }
    .business-combo__control svg { width:1rem; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }
    .business-combo__options { position:absolute; z-index:80; top:calc(100% + .25rem); right:0; left:0; max-height:15rem; overflow:auto; overscroll-behavior:contain; padding:.25rem; border:1px solid var(--theme-border); border-radius:.6rem; background:var(--theme-surface-raised); box-shadow:0 .7rem 1.7rem var(--theme-shadow); }
    .business-combo__options button { display:block; width:100%; min-height:2.35rem; padding:.5rem .6rem; overflow:hidden; border:0; border-radius:.4rem; background:transparent; color:var(--theme-text); text-align:left; text-overflow:ellipsis; white-space:nowrap; font:inherit; font-size:.78rem; cursor:pointer; }
    .business-combo__options button:hover,.business-combo__options button.is-active { background:var(--theme-page-wash); }
    .business-combo__options button.is-selected { color:var(--theme-primary-text); font-weight:700; }
    .business-combo__empty { margin:0; padding:.6rem; color:var(--theme-text-muted); font-size:.78rem; }
  `],
})
export class PersonalBusinessComboboxComponent implements OnChanges {
  @Input() businesses: BusinessOption[] = [];
  @Input() value = 'all';
  @Input() allLabel = '';
  @Input() disabled = false;
  @Input() ariaLabel = '';
  @Input() showOptionsLabel = '';
  @Input() noResultsLabel = '';
  @Output() valueChange = new EventEmitter<string>();
  query = '';
  open = false;
  activeIndex = -1;
  readonly listId = `personal-business-list-${Math.random().toString(36).slice(2, 9)}`;

  constructor(private readonly element: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] || changes['businesses']) this.syncQuery();
  }

  get filteredBusinesses(): BusinessOption[] {
    const normalized = this.query.trim().toLocaleLowerCase();
    return this.businesses.filter(item => !normalized || item.name.toLocaleLowerCase().includes(normalized));
  }

  toggle(): void { this.open = !this.open; if (this.open) this.activeIndex = -1; }
  move(delta: number, event: KeyboardEvent): void { this.open = true; event.preventDefault(); const count = this.filteredBusinesses.length; this.activeIndex = count ? (this.activeIndex + delta + count) % count : -1; }
  chooseActive(event: KeyboardEvent): void {
    if (!this.open) { this.open = true; return; }
    event.preventDefault();
    if (this.activeIndex < 0) this.choose('all', this.allLabel);
    else { const business = this.filteredBusinesses[this.activeIndex]; if (business) this.choose(business.id, business.name); }
  }
  choose(id: string, name: string): void { this.value = id; this.query = name; this.open = false; this.activeIndex = -1; this.valueChange.emit(id); }

  @HostListener('document:click', ['$event']) onDocumentClick(event: MouseEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node)) { this.open = false; this.syncQuery(); }
  }

  private syncQuery(): void { this.query = this.value === 'all' ? '' : this.businesses.find(item => item.id === this.value)?.name || ''; }
}
