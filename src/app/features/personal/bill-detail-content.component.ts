import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { apiBaseUrl } from '../../app-config';
import { PersonalBill } from './personal.models';

@Component({
  selector: 'app-bill-detail-content',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './bill-detail-content.component.html',
  styleUrl: './bill-detail-content.component.scss',
})
export class BillDetailContentComponent implements OnInit, OnDestroy {
  @Input({ required: true }) bill!: PersonalBill;
  selectedImage: PersonalBill['files'][number] | null = null;
  private readonly apiBase = apiBaseUrl();
  private readonly changeDetector = inject(ChangeDetectorRef);
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void { this.timer = setInterval(() => this.changeDetector.markForCheck(), 60_000); }
  ngOnDestroy(): void { clearInterval(this.timer); }
  statusKey(status: string): string { return `f017.${status}`; }
  statusClass(status: string): string { return status.replace(/_/g, '-'); }
  fileUrl(url: string): string { return this.apiBase + url; }
  isImage(type: string): boolean { return type.startsWith('image/'); }
  openImage(file: PersonalBill['files'][number]): void { this.selectedImage = file; }
  closeImage(): void { this.selectedImage = null; }
  @HostListener('document:keydown.escape', ['$event']) onEscape(event: KeyboardEvent): void {
    if (!this.selectedImage) return;
    event.preventDefault();
    this.closeImage();
  }
  hasDiscount(): boolean { return Number(this.bill?.discountTotal || 0) > 0; }
  elapsedKey(): string { const started = this.bill?.deliveryStartedAt; if (!started) return 'personal.deliveryWaiting'; const hours = Math.max(0, (Date.now() - new Date(started).getTime()) / 3_600_000); if (hours < 24) return 'personal.elapsedHours'; const days = hours / 24; if (days < 30) return 'personal.elapsedDays'; const months = days / 30.4375; if (months < 12) return 'personal.elapsedMonths'; return 'personal.elapsedYears'; }
  elapsedValue(): number { const started = this.bill?.deliveryStartedAt; if (!started) return 0; const hours = Math.max(0, (Date.now() - new Date(started).getTime()) / 3_600_000); if (hours < 24) return Math.max(1, Math.floor(hours)); const days = hours / 24; if (days < 30) return Math.max(1, Math.floor(days)); const months = days / 30.4375; if (months < 12) return Math.max(1, Math.floor(months)); return Math.max(1, Math.floor(months / 12)); }
}
