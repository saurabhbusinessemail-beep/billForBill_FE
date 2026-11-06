import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { PersonalDashboardPageComponent } from './personal-dashboard-page.component';
import { PersonalBillPageComponent } from './personal-bill-page.component';
import { PersonalBusinessComboboxComponent } from './personal-business-combobox.component';

@NgModule({
  declarations: [PersonalDashboardPageComponent, PersonalBillPageComponent, PersonalBusinessComboboxComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild([
    { path: '', pathMatch: 'full', component: PersonalDashboardPageComponent },
    { path: 'bills/:billId', component: PersonalBillPageComponent },
  ])],
})
export class PersonalModule {}
