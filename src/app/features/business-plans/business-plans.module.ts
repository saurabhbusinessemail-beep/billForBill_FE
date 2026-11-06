import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { BusinessExtraCreditDialogComponent } from './business-extra-credit-dialog.component';
import { BusinessPlanPurchaseDialogComponent } from './business-plan-purchase-dialog.component';
import { BusinessPlansPageComponent } from './business-plans-page.component';

@NgModule({
  declarations: [BusinessPlansPageComponent, BusinessPlanPurchaseDialogComponent, BusinessExtraCreditDialogComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild([{ path: '', component: BusinessPlansPageComponent }])],
})
export class BusinessPlansModule {}
