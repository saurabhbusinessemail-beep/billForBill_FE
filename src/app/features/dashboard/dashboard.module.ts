import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { adminGuard, adminOrSuperAdminGuard, signedInGuard, superAdminGuard } from '../../core/auth/auth.guard';
import { SharedModule } from '../../shared/shared.module';
import { BusinessDashboardComponent } from './components/business-dashboard.component';
import { OpeningBalanceDialogComponent } from '../opening-balances/opening-balance-dialog.component';
import { BusinessDetailsCardComponent } from './components/business-details-card.component';
import { BusinessFormDialogComponent } from './components/business-form-dialog.component';
import { DashboardHeaderComponent } from './components/dashboard-header.component';
import { FirstTimeSetupDialogComponent } from './components/first-time-setup-dialog.component';
import { NoDataCardComponent } from './components/no-data-card.component';
import { WorkspaceMenuComponent } from './components/workspace-menu.component';
import { DashboardComponent } from './dashboard.component';
import { ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';

const routes: Routes = [{ path: '', component: DashboardComponent, canActivate: [signedInGuard], children: [
  { path: 'personal', loadChildren: () => import('../personal/personal.module').then(m => m.PersonalModule) },
  { path: 'profile', loadChildren: () => import('../profile/profile.module').then(m => m.ProfileModule) },
  { path: 'admin-setup/cleanup', canActivate: [superAdminGuard], loadChildren: () => import('../admin-setup/cleanup/cleanup.module').then(m => m.CleanupModule) },
  { path: 'admin-setup/business-types', canActivate: [adminOrSuperAdminGuard], loadChildren: () => import('../admin-setup/business-types/business-types.module').then(m => m.BusinessTypesModule) },
  { path: 'admin-setup/plans-offers', canActivate: [adminOrSuperAdminGuard], loadChildren: () => import('../plans-offers/plans-offers.module').then(m => m.PlansOffersModule) },
  { path: 'admin-setup/products', canActivate: [adminGuard], loadChildren: () => import('../admin-setup/products/products.module').then(m => m.ProductsModule) },
  { path: 'admin-setup/categories', canActivate: [adminGuard], loadChildren: () => import('../admin-setup/categories/categories.module').then(m => m.CategoriesModule) },
  { path: 'admin-setup/attributes', canActivate: [adminGuard], loadChildren: () => import('../admin-setup/attributes/attributes.module').then(m => m.AttributesModule) },
  { path: 'admin-setup/units', canActivate: [adminGuard], loadChildren: () => import('../admin-setup/units/units.module').then(m => m.UnitsModule) },
  { path: 'admin-setup/taxes', canActivate: [adminGuard], loadChildren: () => import('../admin-setup/taxes/taxes.module').then(m => m.TaxesModule) },
  { path: ':businessId', children: [
    { path: 'bills', loadChildren: () => import('../bills/bills.module').then(m => m.BillsModule) },
    { path: 'payments', loadChildren: () => import('../bills/payments.module').then(m => m.PaymentsModule) },
    { path: 'catalog', loadChildren: () => import('../business-catalog/business-catalog.module').then(m => m.BusinessCatalogModule) },
    { path: 'pricing', loadChildren: () => import('../pricing/pricing.module').then(m => m.PricingModule) },
    { path: 'inventory', loadChildren: () => import('../inventory/inventory.module').then(m => m.InventoryModule) },
    { path: 'reports', loadChildren: () => import('../inventory/reports.module').then(m => m.ReportsModule) },
    { path: 'orders', loadChildren: () => import('../orders/orders.module').then(m => m.OrdersModule) },
    { path: 'transport', loadChildren: () => import('../transport/transport.module').then(m => m.TransportModule) },
    { path: 'leads', loadChildren: () => import('../leads/leads.module').then(m => m.LeadsModule) },
    { path: 'people', loadChildren: () => import('../people/people.module').then(m => m.PeopleModule) },
    { path: 'customer-vendor', loadComponent: () => import('../customer-vendor/customer-vendor-page.component').then(m => m.CustomerVendorPageComponent) },
    { path: 'teams', loadChildren: () => import('../teams/teams.module').then(m => m.TeamsModule) },
    { path: 'plans', loadChildren: () => import('../business-plans/business-plans.module').then(m => m.BusinessPlansModule) },
  ] },
] }];

@NgModule({
  declarations: [
    DashboardComponent, WorkspaceMenuComponent, DashboardHeaderComponent, FirstTimeSetupDialogComponent,
    BusinessFormDialogComponent, BusinessDetailsCardComponent, NoDataCardComponent,
    BusinessDashboardComponent,
  ],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule.forChild(routes), SharedModule, OpeningBalanceDialogComponent],
})
export class DashboardModule {}
