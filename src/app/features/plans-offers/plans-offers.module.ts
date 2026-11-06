import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { PlansOffersPageComponent } from './plans-offers-page.component';

@NgModule({
  declarations: [PlansOffersPageComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild([{ path: '', component: PlansOffersPageComponent }])],
})
export class PlansOffersModule {}
