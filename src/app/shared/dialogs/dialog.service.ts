import { Injectable, signal } from '@angular/core';

export interface ConfirmationDialogConfig {
  titleKey: string;
  messageKey: string;
  confirmKey: string;
  confirmStyle?: 'danger';
  titleParams?: Record<string, string | number>;
  messageParams?: Record<string, string | number>;
}

export interface MessageDialogConfig {
  titleKey: string;
  messageKey: string;
  titleParams?: Record<string, string | number>;
  messageParams?: Record<string, string | number>;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly confirmation = signal<ConfirmationDialogConfig | null>(null);
  readonly message = signal<MessageDialogConfig | null>(null);
  private resolveConfirmation: ((confirmed: boolean) => void) | null = null;
  private resolveMessage: (() => void) | null = null;

  confirm(config: ConfirmationDialogConfig): Promise<boolean> {
    if (this.resolveConfirmation || this.resolveMessage) this.close(false);
    this.confirmation.set(config);
    return new Promise(resolve => { this.resolveConfirmation = resolve; });
  }

  alert(config: MessageDialogConfig): Promise<void> {
    if (this.resolveConfirmation || this.resolveMessage) this.close(false);
    this.message.set(config);
    return new Promise(resolve => { this.resolveMessage = resolve; });
  }

  close(confirmed: boolean): void {
    const resolve = this.resolveConfirmation;
    const resolveMessage = this.resolveMessage;
    this.resolveConfirmation = null;
    this.resolveMessage = null;
    this.confirmation.set(null);
    this.message.set(null);
    resolve?.(confirmed);
    resolveMessage?.();
  }
}
