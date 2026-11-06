import { Component, inject } from '@angular/core';
import { DialogService } from './dialog.service';

@Component({
  selector: 'app-confirmation-dialog',
  standalone: false,
  template: `
    <div class="confirm-backdrop" *ngIf="dialog.confirmation() as config" (click)="dialog.close(false)">
      <section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" (click)="$event.stopPropagation()">
        <header><h2 id="confirm-title">{{ config.titleKey | translate:config.titleParams }}</h2><button type="button" class="close" (click)="dialog.close(false)" [attr.aria-label]="'f006.close' | translate">×</button></header>
        <p id="confirm-message">{{ config.messageKey | translate:config.messageParams }}</p>
        <footer><button type="button" class="confirm-danger" (click)="dialog.close(true)">{{ config.confirmKey | translate }}</button><button type="button" class="confirm-cancel" (click)="dialog.close(false)">{{ 'business.cancel' | translate }}</button></footer>
      </section>
    </div>
    <div class="confirm-backdrop" *ngIf="dialog.message() as message" (click)="dialog.close(false)">
      <section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="message-title" aria-describedby="message-body" (click)="$event.stopPropagation()">
        <header><h2 id="message-title">{{ message.titleKey | translate:message.titleParams }}</h2><button type="button" class="close" (click)="dialog.close(false)" [attr.aria-label]="'f006.close' | translate">×</button></header>
        <p id="message-body">{{ message.messageKey | translate:message.messageParams }}</p>
        <footer><button type="button" class="confirm-ok" (click)="dialog.close(true)">{{ 'f015.close' | translate }}</button></footer>
      </section>
    </div>
  `,
  styles: [`
    :host { display:contents; }
    .confirm-backdrop { position:fixed; inset:0; z-index:1000; display:grid; place-items:center; padding:1rem; background:color-mix(in srgb,var(--theme-text) 18%,transparent); backdrop-filter:blur(4px); }
    .confirm-dialog { width:min(100%,26rem); overflow:hidden; border:1px solid var(--theme-border); border-radius:1rem; background:var(--theme-surface-raised); color:var(--theme-text); box-shadow:0 1rem 3rem color-mix(in srgb,var(--theme-text) 18%,transparent); }
    header { display:flex; align-items:flex-start; justify-content:space-between; gap:.75rem; padding:1rem 1rem .4rem; }
    h2 { margin:0; font-size:1.05rem; line-height:1.45; font-weight:600; }
    .close { flex:0 0 auto; padding:0; border:0; background:transparent; color:var(--theme-text); font-size:1.4rem; line-height:1; cursor:pointer; }
    p { margin:0; padding:0 1rem 1rem; color:var(--theme-text-muted); line-height:1.5; }
    footer { display:grid; gap:.5rem; padding:.9rem 1rem 1rem; border-top:1px solid var(--theme-border); }
    footer button { min-height:2.75rem; border:1px solid var(--theme-border); border-radius:.6rem; font:inherit; cursor:pointer; }
    .confirm-danger { color:var(--theme-danger); background:color-mix(in srgb,var(--theme-danger) 13%,var(--theme-surface)); border-color:transparent; }
    .confirm-cancel { color:var(--theme-text); background:var(--theme-surface); }
    .confirm-ok { color:var(--theme-on-primary); background:var(--theme-primary); border-color:transparent; }
  `],
})
export class ConfirmationDialogComponent { readonly dialog = inject(DialogService); }
