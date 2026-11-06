import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AdminCatalogSharedModule } from '../admin-setup/shared/admin-catalog-shared.module';
import { CatalogPageComponent } from '../admin-setup/shared/catalog-page.component';

@NgModule({
  imports: [CommonModule, AdminCatalogSharedModule, RouterModule.forChild([
    { path: ':kind', component: CatalogPageComponent },
    { path: '', pathMatch: 'full', redirectTo: 'products' },
  ])],
})
export class BusinessCatalogModule {}
