import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BillsSharedModule } from './bills-shared.module';
import { BillsPageComponent } from './bills-page.component';
@NgModule({ imports: [BillsSharedModule, RouterModule.forChild([{ path: '', component: BillsPageComponent }])] })
export class BillsModule {}
