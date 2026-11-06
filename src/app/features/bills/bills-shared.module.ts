import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { BillsPageComponent } from './bills-page.component';
import { PaymentsPageComponent } from './payments-page.component';
@NgModule({ declarations: [BillsPageComponent, PaymentsPageComponent], imports: [CommonModule, FormsModule, RouterModule, SharedModule], exports: [BillsPageComponent, PaymentsPageComponent] })
export class BillsSharedModule {}
