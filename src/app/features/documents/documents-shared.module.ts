import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { DocumentEditorComponent } from './document-editor.component';

@NgModule({ declarations: [DocumentEditorComponent], imports: [CommonModule, FormsModule, SharedModule], exports: [DocumentEditorComponent] })
export class DocumentsSharedModule {}
