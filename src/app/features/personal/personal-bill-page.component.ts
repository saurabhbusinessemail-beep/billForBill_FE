import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { PersonalApiService } from './personal-api.service';
import { PersonalBill } from './personal.models';

@Component({ selector: 'app-personal-bill-page', standalone: false, templateUrl: './personal-bill-page.component.html', styleUrl: './personal-bill-page.component.scss' })
export class PersonalBillPageComponent implements OnInit, AfterViewInit, OnDestroy {
  bill: PersonalBill | null = null; loading = true; errorKey = ''; floating = false; floatingTop = 0; floatingLeft = 0; floatingWidth = 0; copied = false; shareError = '';
  selectedImage: PersonalBill['files'][number] | null = null;
  private scrollContainer: HTMLElement | null = null; private timer?: ReturnType<typeof setInterval>; private readonly onScroll = (): void => this.updateFloating();
  constructor(private readonly api: PersonalApiService, private readonly route: ActivatedRoute, private readonly router: Router) {}
  ngOnInit(): void { this.route.paramMap.subscribe(params => { const id = params.get('billId'); if (id) this.load(id); }); }
  ngAfterViewInit(): void { this.scrollContainer = document.querySelector<HTMLElement>('.workspace-content'); this.scrollContainer?.addEventListener('scroll', this.onScroll, { passive: true }); window.addEventListener('resize', this.onScroll, { passive: true }); requestAnimationFrame(this.onScroll); }
  ngOnDestroy(): void { this.scrollContainer?.removeEventListener('scroll', this.onScroll); window.removeEventListener('resize', this.onScroll); if (this.timer) clearInterval(this.timer); }
  private updateFloating(): void { const title = document.getElementById('personal-bill-title'); const header = document.querySelector<HTMLElement>('app-dashboard-header'); if (!title || !header) return; const rect = header.getBoundingClientRect(); this.floatingTop = rect.bottom; this.floatingLeft = rect.left; this.floatingWidth = rect.width; this.floating = title.getBoundingClientRect().top <= rect.bottom + 1; }
  load(id: string): void { if (this.timer) clearInterval(this.timer); this.loading = true; this.errorKey = ''; this.api.bill(id).subscribe({ next: bill => { this.bill = bill; this.loading = false; this.timer = setInterval(() => this.tick += 1, 60_000); }, error: (error: HttpErrorResponse) => { this.loading = false; this.errorKey = error.status === 401 ? 'personal.sessionError' : 'personal.billNotFound'; if (error.status === 401) void this.router.navigateByUrl('/login'); } }); }
  tick = 0;
  goBack(): void { void this.router.navigate(['/dashboard/personal'], { queryParams: this.route.snapshot.queryParams }); }
  statusKey(status: string): string { return `f017.${status}`; }
  statusClass(status: string): string { return status.replace(/_/g, '-'); }
  fileUrl(url: string): string { return this.api.fileUrl(url); }
  isImage(type: string): boolean { return type.startsWith('image/'); }
  openImage(file: PersonalBill['files'][number]): void { this.selectedImage = file; }
  closeImage(): void { this.selectedImage = null; }
  @HostListener('document:keydown.escape') onEscape(): void { this.closeImage(); }
  hasDiscount(): boolean { return Number(this.bill?.discountTotal || 0) > 0; }
  elapsedKey(): string { const started = this.bill?.deliveryStartedAt; if (!started) return 'personal.deliveryWaiting'; const hours = Math.max(0, (Date.now() - new Date(started).getTime()) / 3_600_000); if (hours < 24) return 'personal.elapsedHours'; const days = hours / 24; if (days < 30) return 'personal.elapsedDays'; const months = days / 30.4375; if (months < 12) return 'personal.elapsedMonths'; return 'personal.elapsedYears'; }
  elapsedValue(): number { const started = this.bill?.deliveryStartedAt; if (!started) return 0; const hours = Math.max(0, (Date.now() - new Date(started).getTime()) / 3_600_000); if (hours < 24) return Math.max(1, Math.floor(hours)); const days = hours / 24; if (days < 30) return Math.max(1, Math.floor(days)); const months = days / 30.4375; if (months < 12) return Math.max(1, Math.floor(months)); return Math.max(1, Math.floor(months / 12)); }
  async copyLink(): Promise<void> { try { await navigator.clipboard.writeText(window.location.href); this.copied = true; setTimeout(() => this.copied = false, 2500); } catch { this.shareError = 'personal.copyFailed'; } }
  async share(): Promise<void> { this.shareError = ''; const title = this.bill?.billNumber || 'Bill'; const url = window.location.href; try { if (navigator.share) await navigator.share({ title, url }); else await this.copyLink(); } catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; this.shareError = 'personal.shareFailed'; } }
  print(): void {
    document.body.classList.add('personal-print-mode');
    const cleanup = (): void => { document.body.classList.remove('personal-print-mode'); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    setTimeout(cleanup, 1500);
  }
}
