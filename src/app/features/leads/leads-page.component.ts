import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { BusinessDocument } from '../documents/documents.models';
import { DocumentsApiService } from '../documents/documents-api.service';

@Component({ selector: 'app-leads-page', standalone: false, templateUrl: './leads-page.component.html', styleUrl: './leads-page.component.scss' })
export class LeadsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  businessId = ''; leads: BusinessDocument[] = []; loading = true; saving = false; errorKey = ''; successKey = '';
  search = ''; status = ''; page = 1; total = 0; hasNextPage = false; editorOpen = false; selected: BusinessDocument | null = null;
  canCreate = false; canEdit = false; canDelete = false; canDiscount = false; canTax = false; canCreateTax = false; canConvert = false; canConvertToBill = false; canCreateBill = false;
  floatingHeading = false; floatingTop = 0; floatingLeft = 0; floatingWidth = 0; floatingBarHeight = 64;
  confirmDelete: BusinessDocument | null = null;
  openMenuId: string | null = null;
  menuTop = 0; menuLeft = 0;
  private scrollContainer: HTMLElement | null = null; private request = 0; private readonly changes = new Subject<string>();
  private readonly updateFloatingHeading = (): void => { const title = document.getElementById('leads-title'); const header = document.querySelector<HTMLElement>('app-dashboard-header'); if (!title || !header || !this.scrollContainer) return; const rect = header.getBoundingClientRect(); this.floatingTop = rect.bottom; this.floatingLeft = rect.left; this.floatingWidth = rect.width; this.floatingHeading = title.getBoundingClientRect().top <= rect.bottom + 1; if (this.floatingHeading) requestAnimationFrame(() => this.measureFloatingBar()); };
  private measureFloatingBar(): void { const bar = document.querySelector<HTMLElement>('.leads-page__floating'); if (!this.floatingHeading || !bar) return; const height = bar.getBoundingClientRect().height; if (Math.abs(this.floatingBarHeight - height) > 0.5) this.floatingBarHeight = height; }
  constructor(private readonly route: ActivatedRoute, private readonly api: DocumentsApiService, private readonly router: Router) {}
  ngOnInit(): void { this.businessId = this.route.parent?.snapshot.paramMap.get('businessId') || ''; this.changes.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => { this.page = 1; this.load(); }); this.load(); }
  ngAfterViewInit(): void { this.scrollContainer = document.querySelector<HTMLElement>('.workspace-content'); this.scrollContainer?.addEventListener('scroll', this.updateFloatingHeading, { passive: true }); window.addEventListener('resize', this.updateFloatingHeading, { passive: true }); requestAnimationFrame(this.updateFloatingHeading); }
  ngOnDestroy(): void { this.scrollContainer?.removeEventListener('scroll', this.updateFloatingHeading); window.removeEventListener('resize', this.updateFloatingHeading); this.changes.complete(); }
  @HostListener('document:click') closeMenuOnOutside(): void { this.openMenuId = null; }
  load(): void { const seq = ++this.request; this.loading = true; this.errorKey = ''; this.api.list<BusinessDocument>(this.businessId, 'leads', { page: this.page, search: this.search.trim(), status: this.status }).subscribe({ next: result => { if (seq !== this.request) return; this.leads = result.items; this.total = result.total; this.hasNextPage = result.hasNextPage; const keys = new Set(result.authorization.permissionKeys); this.canCreate = result.authorization.isOwner || keys.has('business.leads.create'); this.canEdit = result.authorization.isOwner || keys.has('business.leads.edit'); this.canDelete = result.authorization.isOwner || keys.has('business.leads.delete'); this.canDiscount = result.authorization.isOwner || keys.has('business.leads.discount.manage'); this.canTax = result.authorization.isOwner || keys.has('business.leads.tax.manage'); this.canCreateTax = result.authorization.isOwner || keys.has('business.catalog.taxes.manage'); this.canConvert = result.authorization.isOwner || keys.has('business.leads.convert'); this.canCreateBill = result.authorization.isOwner || keys.has('business.bills.create'); this.canConvertToBill = (result.authorization.isOwner || keys.has('business.leads.convertToBill')) && this.canCreateBill; this.loading = false; }, error: (error: HttpErrorResponse) => { if (seq !== this.request) return; this.errorKey = error.status === 403 ? 'f015.forbidden' : 'f015.loadError'; this.loading = false; } }); }
  searchChanged(value: string): void { this.search = value; this.changes.next(value); }
  statusTone(status: string): string { if (['delivered', 'received', 'paid'].includes(status)) return 'document-status-chip--success'; if (['cancelled', 'overdue'].includes(status)) return 'document-status-chip--danger'; if (['in_transit', 'partially_paid'].includes(status)) return 'document-status-chip--warning'; if (['ordered', 'confirmed', 'billed'].includes(status)) return 'document-status-chip--info'; return 'document-status-chip--neutral'; }
  showBillStatus(lead: BusinessDocument): boolean {
    const status = lead.billStatus;
    if (!status || status === lead.status || status === lead.orderStatus) return false;
    if (status === 'confirmed' && lead.status === 'billed') return false;
    if (status === 'delivered' && (lead.status === 'delivered' || lead.orderStatus === 'delivered' || (lead.billSummaries || []).some(bill => bill.deliveryStatus === 'delivered'))) return false;
    return true;
  }
  showBillPaymentStatus(lead: BusinessDocument, paymentStatus: string): boolean {
    return !(lead.status === 'cancelled' && paymentStatus === 'cancelled');
  }
  hasOutstanding(value: string): boolean { return Number(value) > 0; }
  openAdd(): void { this.selected = null; this.editorOpen = true; }
  openLead(lead: BusinessDocument): void { this.selected = lead; this.editorOpen = true; }
  toggleMenu(lead: BusinessDocument, event: Event): void { event.stopPropagation(); if (this.openMenuId === lead.id) { this.openMenuId = null; return; } const rect = (event.currentTarget as HTMLElement).getBoundingClientRect(); this.menuTop = Math.min(rect.bottom, Math.max(8, window.innerHeight - 190)); this.menuLeft = Math.min(Math.max(8, rect.right - 192), Math.max(8, window.innerWidth - 200)); this.openMenuId = lead.id; }
  openFromMenu(lead: BusinessDocument, event: Event): void { event.stopPropagation(); this.openMenuId = null; this.openLead(lead); }
  deleteFromMenu(lead: BusinessDocument, event: Event): void { event.stopPropagation(); this.openMenuId = null; this.delete(lead); }
  rowKeydown(lead: BusinessDocument, event: KeyboardEvent): void { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); this.openLead(lead); } }
  saved(): void { this.editorOpen = false; this.selected = null; this.load(); }
  closeEditor(): void { this.editorOpen = false; this.selected = null; }
  convert(lead: BusinessDocument, mode: 'order' | 'bill'): void { if (this.saving) return; this.saving = true; this.errorKey = ''; this.successKey = ''; this.api.convert(this.businessId, lead, mode).subscribe({ next: order => { this.saving = false; if (mode === 'bill' && order.id) { void this.router.navigate(['/dashboard', this.businessId, 'bills'], { queryParams: { createForOrder: order.id, billType: 'sale', deliveredAtIssue: false } }); return; } this.successKey = 'f015.convertedOrder'; this.load(); }, error: error => { this.saving = false; this.errorKey = error.status === 403 ? 'f015.forbidden' : 'f015.convertError'; } }); }
  delete(lead: BusinessDocument): void { this.confirmDelete = lead; }
  confirmRemove(): void { const lead = this.confirmDelete; if (!lead) return; this.api.remove(this.businessId, 'leads', lead.id).subscribe({ next: () => { this.confirmDelete = null; this.load(); }, error: () => { this.confirmDelete = null; this.errorKey = 'f015.deleteError'; } }); }
  formatDate(value: string): string { return value?.slice(0, 10) || ''; }
  changePage(page: number): void { this.page = page; this.load(); }
}
