import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { ProfilePageComponent } from './profile-page.component';

@NgModule({
  declarations: [ProfilePageComponent],
  imports: [CommonModule, ReactiveFormsModule, SharedModule, RouterModule.forChild([{ path: '', component: ProfilePageComponent }])],
})
export class ProfileModule {}
