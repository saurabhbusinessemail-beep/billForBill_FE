import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { BusinessDocument, OrderType } from '../documents/documents.models';
import { DocumentsApiService } from '../documents/documents-api.service';
import { BillsApiService } from '../bills/bills-api.service';
import { Router } from '@angular/router';
import { DialogService } from '../../shared/dialogs/dialog.service';

@Component({ selector: 'app-orders-page', standalone: false, templateUrl: './orders-page.component.html', styleUrl: './orders-page.component.scss' })
export class OrdersPageComponent implements OnInit, AfterViewInit, OnDestroy {
  businessId = ''; orderType: OrderType = 'sales'; orders: BusinessDocument[] = []; loading = true; errorKey = '';
  search = ''; status = ''; page = 1; total = 0; hasNextPage = false; editorOpen = false; selected: BusinessDocument | null = null;
  canCreate = false; canEdit = false; canDelete = false; canDiscount = false; canTax = false; canCreateTax = false; canGenerateBill = false; canManageDelivery = false;
  canCreateBill = false;
  openMenuId: string | null = null;
  menuTop = 0; menuLeft = 0;
  confirmDelete: BusinessDocument | null = null; floatingHeading = false; floatingTop = 0; floatingLeft = 0; floatingWidth = 0; floatingBarHeight = 64; floatingTabsHeight = 43.2;
  private scrollContainer: HTMLElement | null = null; private request = 0; private detailRequest = 0; private readonly changes = new Subject<string>();
  private readonly updateFloatingHeading = (): void => {
    const title = document.getElementById('orders-title'); const header = document.querySelector<HTMLElement>('app-dashboard-header');
    if (!title || !header || !this.scrollContainer) return;
    const rect = header.getBoundingClientRect(); const was = this.floatingHeading;
    this.floatingTop = rect.bottom; this.floatingLeft = rect.left; this.floatingWidth = rect.width;
    this.floatingHeading = title.getBoundingClientRect().top <= rect.bottom + 1;
    if (this.floatingHeading) requestAnimationFrame(() => {
      this.measureFloatingStack();
      if (!was) this.updateFloatingHeading();
    });
  };
  private measureFloatingStack(): void {
    if (!this.floatingHeading) return;
    const bar = document.querySelector<HTMLElement>('.orders-page__floating');
    const tabs = document.querySelector<HTMLElement>('.orders-page__floating-tabs');
    if (!bar || !tabs) return;
    const barHeight = bar.getBoundingClientRect().height;
    const tabsHeight = tabs.getBoundingClientRect().height;
    if (Math.abs(this.floatingBarHeight - barHeight) > 0.5) this.floatingBarHeight = barHeight;
    if (Math.abs(this.floatingTabsHeight - tabsHeight) > 0.5) this.floatingTabsHeight = tabsHeight;
  }
  constructor(private readonly route: ActivatedRoute, private readonly api: DocumentsApiService, private readonly billsApi: BillsApiService, private readonly router: Router, private readonly dialogs: DialogService) {}
  ngOnInit(): void { this.businessId = this.route.parent?.snapshot.paramMap.get('businessId') || ''; this.changes.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => { this.page = 1; this.load(); }); this.load(); }
  ngAfterViewInit(): void { this.scrollContainer = document.querySelector<HTMLElement>('.workspace-content'); this.scrollContainer?.addEventListener('scroll', this.updateFloatingHeading, { passive: true }); window.addEventListener('resize', this.updateFloatingHeading, { passive: true }); requestAnimationFrame(this.updateFloatingHeading); }
  ngOnDestroy(): void { this.scrollContainer?.removeEventListener('scroll', this.updateFloatingHeading); window.removeEventListener('resize', this.updateFloatingHeading); this.changes.complete(); }
  @HostListener('document:click') closeMenuOnOutside(): void { this.openMenuId = null; }
  load(): void {
    const seq = ++this.request; this.loading = true; this.errorKey = '';
    this.api.list<BusinessDocument>(this.businessId, 'orders', { page: this.page, search: this.search.trim(), status: this.status, orderType: this.orderType }).subscribe({
      next: result => { if (seq !== this.request) return; this.orders = result.items; this.total = result.total; this.hasNextPage = result.hasNextPage; const keys = new Set(result.authorization.permissionKeys); this.canCreate = result.authorization.isOwner || keys.has('business.orders.create'); this.canEdit = result.authorization.isOwner || keys.has('business.orders.edit'); this.canDelete = result.authorization.isOwner || keys.has('business.orders.delete'); this.canDiscount = result.authorization.isOwner || keys.has('business.orders.discount.manage'); this.canTax = result.authorization.isOwner || keys.has('business.orders.tax.manage'); this.canCreateTax = result.authorization.isOwner || keys.has('business.catalog.taxes.manage'); this.canCreateBill = result.authorization.isOwner || keys.has('business.bills.create'); this.canGenerateBill = this.canCreateBill; this.canManageDelivery = result.authorization.isOwner || keys.has('business.bills.delivery.manage'); this.loading = false; },
      error: (error: HttpErrorResponse) => { if (seq !== this.request) return; this.errorKey = error.status === 403 ? 'f015.forbidden' : 'f015.loadError'; this.loading = false; },
    });
  }
  setTab(value: OrderType): void { if (this.orderType === value) return; this.orderType = value; this.page = 1; this.load(); }
  searchChanged(value: string): void { this.search = value; this.changes.next(value); }
  statusTone(status: string): string { if (['delivered', 'received', 'paid'].includes(status)) return 'document-status-chip--success'; if (['cancelled', 'overdue'].includes(status)) return 'document-status-chip--danger'; if (['in_transit', 'partially_paid'].includes(status)) return 'document-status-chip--warning'; if (['ordered', 'confirmed', 'billed'].includes(status)) return 'document-status-chip--info'; return 'document-status-chip--neutral'; }
  hasOutstanding(value: string): boolean { return Number(value) > 0; }
  openAdd(): void { this.selected = null; this.editorOpen = true; }
  openDocument(document: BusinessDocument): void {
    const request = ++this.detailRequest;
    this.api.get(this.businessId, 'orders', document.id).subscribe({
      next: details => { if (request !== this.detailRequest) return; this.selected = details; this.editorOpen = true; },
      error: (error: HttpErrorResponse) => { if (request !== this.detailRequest) return; this.errorKey = error.status === 403 ? 'f015.forbidden' : 'f015.loadError'; },
    });
  }
  toggleMenu(document: BusinessDocument, event: Event): void { event.stopPropagation(); if (this.openMenuId === document.id) { this.openMenuId = null; return; } const rect = (event.currentTarget as HTMLElement).getBoundingClientRect(); this.menuTop = Math.min(rect.bottom, Math.max(8, window.innerHeight - 190)); this.menuLeft = Math.min(Math.max(8, rect.right - 192), Math.max(8, window.innerWidth - 200)); this.openMenuId = document.id; }
  openFromMenu(document: BusinessDocument, event: Event): void { event.stopPropagation(); this.openMenuId = null; this.openDocument(document); }
  deleteFromMenu(document: BusinessDocument, event: Event): void { event.stopPropagation(); this.openMenuId = null; this.delete(document); }
  canMarkDelivered(order: BusinessDocument): boolean { return this.canManageDelivery && (order.billSummaries || []).some(bill => bill.deliveryStatus === 'in_transit'); }
  viewBill(order: BusinessDocument, event: Event): void { event.stopPropagation(); this.openMenuId = null; const bills = order.billSummaries || []; const bill = bills.find(item => item.paymentStatus !== 'cancelled') || bills[bills.length - 1]; if (!bill) return; void this.router.navigate(['/dashboard', this.businessId, 'bills'], { queryParams: { viewBill: bill.id } }); }
  showBillPaymentStatus(order: BusinessDocument, paymentStatus: string): boolean { return !(order.status === 'cancelled' && paymentStatus === 'cancelled'); }
  private async markOrderBillDelivered(order: BusinessDocument): Promise<void> { const bill = (order.billSummaries || []).find(item => item.deliveryStatus === 'in_transit'); if (!bill) { this.errorKey = 'f015.actionError'; return; } if (!await this.dialogs.confirm({ titleKey: 'f017.confirmDeliveryTitle', messageKey: 'f017.confirmDeliveryMessage', confirmKey: 'f017.confirmDelivery' })) return; this.billsApi.setDelivery(this.businessId, bill.id, order.orderType === 'purchase' ? 'received' : 'delivered', '', `Order ${order.orderNumber}`).subscribe({ next: () => this.load(), error: (failure: HttpErrorResponse) => { this.errorKey = failure.error?.error?.code === 'INSUFFICIENT_STOCK' ? 'f022.insufficientStock' : 'f015.actionError'; } }); }
  async cancelFromMenu(order: BusinessDocument, event: Event): Promise<void> {
    event.stopPropagation(); this.openMenuId = null;
    if (!await this.dialogs.confirm({ titleKey: 'f017.confirmCancelOrderTitle', messageKey: 'f017.confirmCancelOrderMessage', messageParams: { number: order.orderNumber || '' }, confirmKey: 'f017.cancelOrder', confirmStyle: 'danger' })) return;
    this.api.orderAction(this.businessId, order, 'cancel').subscribe({ next: () => this.load(), error: (error: HttpErrorResponse) => { void this.showCancellationError(error, order.currencyCode || 'INR'); } });
  }
  private async showCancellationError(error: HttpErrorResponse, currencyCode: string): Promise<void> {
    const code = error.error?.error?.code; const details = error.error?.error?.details;
    if (code === 'CANCEL_BLOCKED_PAYMENT') {
      const payments = (details?.payments || []).map((payment: { paymentNumber: string; bills?: Array<{ billNumber: string; amount: string }>; amount: string }) => `${payment.paymentNumber}: ${(payment.bills || []).map(bill => `${bill.billNumber} ${new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(Number(bill.amount))}`).join(', ') || payment.amount}`).join('; ');
      await this.dialogs.alert({ titleKey: 'f017.cancelBlockedTitle', messageKey: 'f017.cancelBlockedPayments', messageParams: { payments } }); return;
    }
    if (code === 'CANCEL_BLOCKED_DELIVERED') { await this.dialogs.alert({ titleKey: 'f017.cancelBlockedTitle', messageKey: 'f017.cancelBlockedDelivered' }); return; }
    await this.dialogs.alert({ titleKey: 'f017.cancelBlockedTitle', messageKey: 'f017.cancelActionError' });
  }
  orderAction(document: BusinessDocument, action: 'confirm' | 'generate_bill' | 'mark_delivered', event: Event): void { event.stopPropagation(); this.openMenuId = null; if (action === 'mark_delivered') { void this.markOrderBillDelivered(document); return; } if (action === 'generate_bill') { if (!this.canCreateBill || !document.contactUserId) { this.errorKey = !this.canCreateBill ? 'f017.billPermissionRequired' : 'f017.partyMissing'; return; } void this.router.navigate(['/dashboard', this.businessId, 'bills'], { queryParams: { createForOrder: document.id, billType: document.orderType === 'purchase' ? 'purchase' : 'sale', deliveredAtIssue: false, entryMode: document.entryMode === 'image_only' ? 'image' : 'detailed' } }); return; } this.api.orderAction(this.businessId, document, action).subscribe({ next: () => this.load(), error: error => { this.errorKey = error.status === 403 ? 'f015.forbidden' : 'f015.actionError'; } }); }
  rowKeydown(document: BusinessDocument, event: KeyboardEvent): void { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); this.openDocument(document); } }
  saved(): void { this.editorOpen = false; this.selected = null; this.load(); }
  closeEditor(): void { this.editorOpen = false; this.selected = null; }
  delete(document: BusinessDocument): void { this.confirmDelete = document; }
  confirmRemove(): void { const item = this.confirmDelete; if (!item) return; this.api.remove(this.businessId, 'orders', item.id).subscribe({ next: () => { this.confirmDelete = null; this.load(); }, error: () => { this.errorKey = 'f015.deleteError'; this.confirmDelete = null; } }); }
  imageUrl(document: BusinessDocument): string | null { const image = document.imageMetadata?.[0]; const id = image?._id || image?.id; return id ? this.api.imageUrl(this.businessId, document.id, id) : null; }
  countItems(document: BusinessDocument): number { return document.entryMode === 'image_only' ? 0 : (document.lines || []).length; }
  formatDate(value: string): string { return value?.slice(0, 10) || ''; }
  changePage(page: number): void { this.page = page; this.load(); }
}
