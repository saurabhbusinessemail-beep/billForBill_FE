import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../../shared/shared.module';
import { CleanupPageComponent } from './cleanup-page.component';
@NgModule({ declarations: [CleanupPageComponent], imports: [SharedModule, FormsModule, RouterModule.forChild([{ path: '', component: CleanupPageComponent }])] })
export class CleanupModule {}
