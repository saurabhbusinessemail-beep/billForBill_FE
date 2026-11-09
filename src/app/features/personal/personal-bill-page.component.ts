import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { PersonalApiService } from './personal-api.service';
import { PersonalBill } from './personal.models';

@Component({ selector: 'app-personal-bill-page', standalone: false, templateUrl: './personal-bill-page.component.html', styleUrl: './personal-bill-page.component.scss' })
export class PersonalBillPageComponent implements OnInit, AfterViewInit, OnDestroy {
  bill: PersonalBill | null = null; loading = true; errorKey = ''; floating = false; floatingTop = 0; floatingLeft = 0; floatingWidth = 0; copied = false; shareError = '';
  private scrollContainer: HTMLElement | null = null; private readonly onScroll = (): void => this.updateFloating();
  constructor(private readonly api: PersonalApiService, private readonly route: ActivatedRoute, private readonly router: Router) {}
  ngOnInit(): void { this.route.paramMap.subscribe(params => { const id = params.get('billId'); if (id) this.load(id); }); }
  ngAfterViewInit(): void { this.scrollContainer = document.querySelector<HTMLElement>('.workspace-content'); this.scrollContainer?.addEventListener('scroll', this.onScroll, { passive: true }); window.addEventListener('resize', this.onScroll, { passive: true }); requestAnimationFrame(this.onScroll); }
  ngOnDestroy(): void { this.scrollContainer?.removeEventListener('scroll', this.onScroll); window.removeEventListener('resize', this.onScroll); }
  private updateFloating(): void { const title = document.getElementById('personal-bill-title'); const header = document.querySelector<HTMLElement>('app-dashboard-header'); if (!title || !header) return; const rect = header.getBoundingClientRect(); this.floatingTop = rect.bottom; this.floatingLeft = rect.left; this.floatingWidth = rect.width; this.floating = title.getBoundingClientRect().top <= rect.bottom + 1; }
  load(id: string): void { this.loading = true; this.errorKey = ''; this.api.bill(id).subscribe({ next: bill => { this.bill = bill; this.loading = false; }, error: (error: HttpErrorResponse) => { this.loading = false; this.errorKey = error.status === 401 ? 'personal.sessionError' : 'personal.billNotFound'; if (error.status === 401) void this.router.navigateByUrl('/login'); } }); }
  goBack(): void { void this.router.navigate(['/dashboard/personal'], { queryParams: this.route.snapshot.queryParams }); }
  statusKey(status: string): string { return `f017.${status}`; }
  statusClass(status: string): string { return status.replace(/_/g, '-'); }
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
