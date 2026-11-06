import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { PeoplePageComponent } from './people-page.component';
const routes: Routes = [{ path: '', component: PeoplePageComponent }];
@NgModule({ declarations: [PeoplePageComponent], imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)] })
export class PeopleModule {}
