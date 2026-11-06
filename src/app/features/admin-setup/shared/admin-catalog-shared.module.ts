import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';
import { CatalogPageComponent } from './catalog-page.component';

@NgModule({ declarations: [CatalogPageComponent], imports: [CommonModule, FormsModule, SharedModule], exports: [CatalogPageComponent] })
export class AdminCatalogSharedModule {}
