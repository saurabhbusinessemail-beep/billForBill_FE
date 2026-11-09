import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { DocumentEditorComponent } from './document-editor.component';
import { OrderProductComboboxComponent } from './order-product-combobox.component';

@NgModule({ declarations: [DocumentEditorComponent, OrderProductComboboxComponent], imports: [CommonModule, FormsModule, SharedModule], exports: [DocumentEditorComponent] })
export class DocumentsSharedModule {}
