import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { DocumentsSharedModule } from '../documents/documents-shared.module';
import { OrdersPageComponent } from './orders-page.component';

@NgModule({ declarations: [OrdersPageComponent], imports: [CommonModule, SharedModule, DocumentsSharedModule, RouterModule.forChild([{ path: '', component: OrdersPageComponent }])] })
export class OrdersModule {}
