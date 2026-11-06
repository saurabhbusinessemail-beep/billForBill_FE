import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { TeamsPageComponent } from './teams-page.component';
import { TeamManageComponent } from './team-manage.component';
const routes: Routes = [{ path: '', component: TeamsPageComponent }, { path: ':teamId', component: TeamManageComponent }];
@NgModule({ declarations: [TeamsPageComponent, TeamManageComponent], imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)] })
export class TeamsModule {}
