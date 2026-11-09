import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { ReportsPageComponent } from './reports-page.component';
import { OpeningBalanceDialogComponent } from '../opening-balances/opening-balance-dialog.component';
@NgModule({ declarations: [ReportsPageComponent], imports: [CommonModule, FormsModule, SharedModule, OpeningBalanceDialogComponent, RouterModule.forChild([{ path: '', component: ReportsPageComponent }])] })
export class ReportsModule {}
