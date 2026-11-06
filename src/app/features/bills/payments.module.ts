import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BillsSharedModule } from './bills-shared.module';
import { PaymentsPageComponent } from './payments-page.component';
@NgModule({ imports: [BillsSharedModule, RouterModule.forChild([{ path: '', component: PaymentsPageComponent }])] })
export class PaymentsModule {}
