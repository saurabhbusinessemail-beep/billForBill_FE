import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TranslatePipe } from './i18n/translate.pipe';
import { ConfirmationDialogComponent } from './dialogs/confirmation-dialog.component';

@NgModule({
  declarations: [TranslatePipe, ConfirmationDialogComponent],
  imports: [CommonModule],
  exports: [CommonModule, TranslatePipe, ConfirmationDialogComponent],
})
export class SharedModule {}
