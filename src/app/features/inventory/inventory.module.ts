import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { InventoryPageComponent } from './inventory-page.component';
@NgModule({ declarations: [InventoryPageComponent], imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild([{ path: '', component: InventoryPageComponent }])] })
export class InventoryModule {}
