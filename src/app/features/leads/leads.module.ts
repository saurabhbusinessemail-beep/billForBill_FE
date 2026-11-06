import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { DocumentsSharedModule } from '../documents/documents-shared.module';
import { LeadsPageComponent } from './leads-page.component';

@NgModule({ declarations: [LeadsPageComponent], imports: [CommonModule, SharedModule, DocumentsSharedModule, RouterModule.forChild([{ path: '', component: LeadsPageComponent }])] })
export class LeadsModule {}
