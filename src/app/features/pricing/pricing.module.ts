import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { PricingPageComponent } from './pricing-page.component';
@NgModule({ declarations: [PricingPageComponent], imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild([{ path: '', component: PricingPageComponent }])] })
export class PricingModule {}
