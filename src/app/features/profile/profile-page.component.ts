import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ProfileApiService } from './profile-api.service';
import { AddressInput, AddressLabel, ProfileAddress, UserProfile } from './profile.models';

@Component({ selector: 'app-profile-page', standalone: false, templateUrl: './profile-page.component.html', styleUrl: './profile-page.component.scss' })
export class ProfilePageComponent implements OnInit {
  profile: UserProfile | null = null;
  loading = true;
  busy = false;
  errorKey = '';
  formErrorKey = '';
  successKey = '';
  addressDialogOpen = false;
  editingAddress: ProfileAddress | null = null;
  pendingDelete: ProfileAddress | null = null;

  readonly labels: AddressLabel[] = ['home', 'work', 'warehouse', 'shop', 'other'];
  readonly form = this.fb.nonNullable.group({
    label: this.fb.nonNullable.control<AddressLabel>('home', Validators.required),
    contactName: ['', [Validators.required, Validators.maxLength(120)]],
    phone: ['', [Validators.required, Validators.maxLength(30)]],
    line1: ['', [Validators.required, Validators.maxLength(200)]],
    line2: ['', Validators.maxLength(200)],
    city: ['', [Validators.required, Validators.maxLength(100)]],
    state: ['', [Validators.required, Validators.maxLength(100)]],
    pincode: ['', [Validators.required, Validators.maxLength(20)]],
    country: ['', [Validators.required, Validators.maxLength(100)]],
  });

  constructor(private readonly fb: FormBuilder, private readonly api: ProfileApiService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.errorKey = '';
    this.api.load().subscribe({
      next: (profile) => { this.profile = profile; this.loading = false; },
      error: (error: HttpErrorResponse) => { this.loading = false; this.errorKey = error.status === 401 ? 'profile.sessionError' : 'profile.loadError'; },
    });
  }

  openAdd(): void {
    this.editingAddress = null;
    this.form.reset({ label: 'home', contactName: this.profile?.user.name ?? '', phone: this.profile?.user.phoneE164 ?? '', line1: '', line2: '', city: '', state: '', pincode: '', country: '' });
    this.openDialog();
  }

  openEdit(address: ProfileAddress): void {
    this.editingAddress = address;
    this.form.reset({ label: address.label, contactName: address.contactName, phone: address.phone, line1: address.line1, line2: address.line2, city: address.city, state: address.state, pincode: address.pincode, country: address.country });
    this.openDialog();
  }

  private openDialog(): void { this.formErrorKey = ''; this.successKey = ''; this.addressDialogOpen = true; }
  closeDialog(): void { if (!this.busy) this.addressDialogOpen = false; }
  chooseLabel(label: AddressLabel): void { this.form.controls.label.setValue(label); }

  saveAddress(): void {
    if (this.form.invalid || this.busy) { this.form.markAllAsTouched(); return; }
    this.busy = true;
    this.formErrorKey = '';
    const value = this.form.getRawValue() as AddressInput;
    const request = this.editingAddress ? this.api.updateAddress(this.editingAddress.id, value) : this.api.addAddress(value);
    request.subscribe({
      next: (profile) => { this.profile = profile; this.busy = false; this.addressDialogOpen = false; this.successKey = 'profile.addressSaved'; },
      error: (error: HttpErrorResponse) => { this.busy = false; this.formErrorKey = error.status === 401 ? 'profile.sessionError' : 'profile.saveError'; },
    });
  }

  confirmDelete(address: ProfileAddress): void { this.pendingDelete = address; }
  cancelDelete(): void { this.pendingDelete = null; }

  deleteAddress(): void {
    if (!this.pendingDelete || this.busy) return;
    this.busy = true;
    this.api.deleteAddress(this.pendingDelete.id).subscribe({
      next: (profile) => { this.profile = profile; this.busy = false; this.pendingDelete = null; this.successKey = 'profile.addressDeleted'; },
      error: (error: HttpErrorResponse) => { this.busy = false; this.pendingDelete = null; this.errorKey = error.status === 401 ? 'profile.sessionError' : 'profile.deleteError'; },
    });
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void { this.closeDialog(); this.cancelDelete(); }
}
