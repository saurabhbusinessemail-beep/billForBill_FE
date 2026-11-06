import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { TransportPageComponent } from './transport-page.component';
const routes:Routes=[{path:'',component:TransportPageComponent},{path:'new',component:TransportPageComponent}];
@NgModule({declarations:[TransportPageComponent],imports:[CommonModule,FormsModule,SharedModule,RouterModule.forChild(routes)]}) export class TransportModule{}
