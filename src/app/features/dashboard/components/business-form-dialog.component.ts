import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Workspace, BusinessDetails, BusinessTypeOption } from '../workspace.models';
import { WorkspaceService } from '../workspace.service';
import { prepareBusinessLogo } from '../logo-image-processor';
import { BusinessAdminService } from '../../people/business-admin.service';
import { BillsApiService } from '../../bills/bills-api.service';

const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Component({
  selector: 'app-business-form-dialog', standalone: false,
  templateUrl: './business-form-dialog.component.html', styleUrl: './business-form-dialog.component.scss',
})
export class BusinessFormDialogComponent implements OnChanges, OnInit {
  @Input() business: Workspace | null = null;
  @Input() isSaving = false;
  @Input() errorKey = '';
  @Output() readonly saveBusiness = new EventEmitter<{ details: BusinessDetails; logo: File | null; removeLogo: boolean; creationRequestKey: string }>();
  @Output() readonly cancel = new EventEmitter<void>();
  readonly form = this.formBuilder.nonNullable.group({
    legalName: ['', [Validators.required, Validators.maxLength(200)]],
    businessTypeId: ['', Validators.required],
    currencyCode: ['INR', Validators.required],
    registrationId: ['', Validators.maxLength(100)],
    gstin: ['', Validators.pattern(/^(?:\s*|\s*[A-Za-z0-9]{15}\s*)$/)],
    phone: ['', Validators.maxLength(40)],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    website: ['', [Validators.maxLength(2048), this.websiteValidator]],
    address: ['', Validators.maxLength(1000)],
  });
  logoFile: File | null = null;
  logoErrorKey = '';
  isProcessingLogo = false;
  removeExistingLogo = false;
  previewUrl = '';
  businessTypes: BusinessTypeOption[] = [];
  businessTypesError = false;
  businessTypesLoaded = false;
  creationRequestKey = globalThis.crypto.randomUUID();
  paymentMethodManagementAllowed = false;
  paymentSettingsLoading = false;
  paymentSettingsSaving = false;
  paymentSettingsExpanded = false;
  paymentSettingsMessage = '';
  paymentSettingsError = false;
  numberSettingsExpanded = false;
  numberSettingsError = false;
  numberSettingsSaving = false;
  numberConfig: Record<string, string> = { orderSalesPrefix: 'SO', orderPurchasePrefix: 'PO', billSalesPrefix: 'SB', billPurchasePrefix: 'PB', paymentPrefix: 'PAY', deliveryPrefix: 'DLV' };
  transportConfigAllowed = false;
  transportSettingsLoading = false;
  transportSettingsLoaded = false;
  transportSettingsSaving = false;
  transportSettingsExpanded = false;
  transportSettingsError = false;
  transportSettingsSaved = false;
  transportFields: Record<string, Record<string, boolean>> = {};
  transportTypeExpanded: Record<string, boolean> = {};
  readonly transportTypes = [
    { type: 'inPerson', fields: ['carriedBy', 'phone', 'notes'] },
    { type: 'bikeScooter', fields: ['vehicleNumber', 'riderName', 'riderPhone'] },
    { type: 'autoTempo', fields: ['vehicleNumber', 'driverName', 'driverPhone'] },
    { type: 'car', fields: ['vehicleNumber', 'driverName', 'driverPhone'] },
    { type: 'truck', fields: ['vehicleNumber', 'driverName', 'driverPhone', 'lrBiltyNumber', 'ewayBillNumber'] },
    { type: 'bus', fields: ['busOperator', 'busNumber', 'ticketReceiptNumber', 'departure', 'conductorDriverPhone'] },
    { type: 'train', fields: ['trainNumber', 'trainName', 'pnr', 'coachParcelVan', 'railwayReceiptNumber', 'departure'] },
    { type: 'flight', fields: ['airline', 'flightNumber', 'pnr', 'airWaybillNumber', 'departure'] },
    { type: 'courier', fields: ['courierPartner', 'trackingAwbNumber', 'trackingLink', 'expectedDelivery'] },
    { type: 'shipCargo', fields: ['vesselName', 'containerNumber', 'billOfLadingNumber', 'portOfLoading'] },
    { type: 'other', fields: ['describeTransport', 'referenceNumber'] },
    { type: 'handedToCustomer', fields: ['receivedBy', 'receiverPhone', 'deliveryOtpCode', 'notes'] },
  ];
  readonly numberFields = ['orderSalesPrefix', 'orderPurchasePrefix', 'billSalesPrefix', 'billPurchasePrefix', 'paymentPrefix', 'deliveryPrefix'];
  paymentFields: Record<string, Record<string, string>> = { cash: { paidBy: 'optional' }, upi: { upiId: 'optional', transactionReference: 'optional' }, card: { lastFour: 'optional', approvalCode: 'optional' }, bank_transfer: { reference: 'optional', bankName: 'optional' } };
  readonly paymentMethods = [
    { method: 'cash', label: 'f017.method_cash', fields: ['paidBy'] },
    { method: 'upi', label: 'f017.method_upi', fields: ['upiId', 'transactionReference'] },
    { method: 'card', label: 'f017.method_card', fields: ['lastFour', 'approvalCode'] },
    { method: 'bank_transfer', label: 'f017.method_bank_transfer', fields: ['reference', 'bankName'] },
  ];

  constructor(private readonly formBuilder: FormBuilder, readonly workspaceService: WorkspaceService, private readonly businessAdmin: BusinessAdminService, private readonly billsApi: BillsApiService) {}

  ngOnInit(): void {
    this.loadBusinessTypes();
  }
  loadBusinessTypes(): void { this.businessTypesError = false; this.workspaceService.listBusinessTypes().subscribe({ next: types => { this.businessTypes = types; this.businessTypesLoaded = true; }, error: () => { this.businessTypesError = true; } }); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['business']) {
      const business = this.business;
      if (!business) this.creationRequestKey = globalThis.crypto.randomUUID();
      this.form.reset({
        legalName: business?.legalName ?? '', businessTypeId: business?.businessTypeId ?? '', registrationId: business?.registrationId ?? '',
        currencyCode: business?.currencyCode ?? 'INR',
        gstin: business?.gstin ?? '',
        phone: business?.phone ?? '', email: business?.email ?? '', website: business?.website ?? '', address: business?.address ?? '',
      });
      if (business?.businessTypeId) this.form.controls.businessTypeId.disable({ emitEvent: false }); else this.form.controls.businessTypeId.enable({ emitEvent: false });
      this.logoFile = null;
      this.logoErrorKey = '';
      this.removeExistingLogo = false;
      this.setPreview('');
      this.paymentSettingsExpanded = false;
      this.numberSettingsExpanded = false;
      this.transportSettingsExpanded = false;
      this.transportSettingsLoading = false;
      this.transportSettingsSaving = false;
      this.transportSettingsError = false;
      this.transportSettingsSaved = false;
      this.transportSettingsLoaded = false;
      this.transportConfigAllowed = false;
      this.transportFields = this.emptyTransportFields();
      this.transportTypeExpanded = Object.fromEntries(this.transportTypes.map(item => [item.type, true]));
      this.loadPaymentSettings();
    }
  }

  get isEditing(): boolean { return Boolean(this.business); }
  get businessTypeUnavailable(): boolean { return this.businessTypesLoaded && this.isEditing && Boolean(this.business?.businessTypeId) && !this.businessTypes.some(type => type.id === this.business?.businessTypeId); }
  get canAssignBusinessType(): boolean { return this.isEditing && !this.business?.businessTypeId; }

  loadPaymentSettings(): void {
    this.paymentMethodManagementAllowed = false;
    this.transportConfigAllowed = false;
    this.paymentSettingsMessage = '';
    if (!this.business || this.business.kind !== 'business') return;
    const id = this.business.id;
    this.businessAdmin.catalogAuthorization(id).subscribe({ next: result => {
      this.paymentMethodManagementAllowed = Boolean(result.isOwner || result.permissionKeys.includes('business.paymentMethods.manage'));
      this.transportConfigAllowed = Boolean(result.isOwner || result.permissionKeys.includes('business.transportConfig.manage'));
      if (this.transportConfigAllowed) {
        this.loadTransportSettings(id);
      }
      if (!this.paymentMethodManagementAllowed) return;
      this.paymentSettingsLoading = true;
      this.billsApi.methodConfig(id).subscribe({ next: fields => { this.paymentFields = fields; this.paymentSettingsLoading = false; }, error: () => { this.paymentSettingsLoading = false; this.paymentSettingsError = true; } });
      this.billsApi.numberConfig(id).subscribe({ next: config => { this.numberConfig = config; }, error: () => { this.numberSettingsError = true; } });
    }, error: () => { this.paymentMethodManagementAllowed = false; } });
  }

  savePaymentSettings(): void {
    if (!this.business || this.paymentSettingsSaving) return;
    this.paymentSettingsSaving = true; this.paymentSettingsMessage = ''; this.paymentSettingsError = false;
    this.billsApi.saveMethodConfig(this.business.id, this.paymentFields).subscribe({ next: fields => { this.paymentFields = fields; this.paymentSettingsSaving = false; this.paymentSettingsMessage = 'f017.paymentSettingsSaved'; }, error: () => { this.paymentSettingsSaving = false; this.paymentSettingsError = true; } });
  }

  saveNumberSettings(): void { if (!this.business || this.numberSettingsSaving) return; this.numberSettingsSaving = true; this.numberSettingsError = false; this.billsApi.saveNumberConfig(this.business.id, this.numberConfig).subscribe({ next: config => { this.numberConfig = config; this.numberSettingsSaving = false; }, error: () => { this.numberSettingsSaving = false; this.numberSettingsError = true; } }); }

  transportLabel(type: string, field?: string): string { return field ? `f020.field.${field}` : `f020.type.${type}`; }
  toggleTransportType(type: string): void { this.transportTypeExpanded[type] = !this.transportTypeExpanded[type]; }
  transportRequiredCount(type: string): number { return Object.values(this.transportFields[type] || {}).filter(Boolean).length; }
  loadTransportSettings(id = this.business?.id): void { if (!id) return; this.transportSettingsLoading = true; this.transportSettingsError = false; this.transportSettingsSaved = false; this.transportSettingsLoaded = false; this.billsApi.transportConfig(id).subscribe({ next: fields => { if (this.business?.id !== id) return; this.transportFields = fields; this.transportSettingsLoading = false; this.transportSettingsLoaded = true; }, error: () => { if (this.business?.id !== id) return; this.transportSettingsLoading = false; this.transportSettingsError = true; } }); }
  saveTransportSettings(): void { if (!this.business || !this.transportSettingsLoaded || this.transportSettingsSaving) return; this.transportSettingsSaving = true; this.transportSettingsError = false; this.transportSettingsSaved = false; this.billsApi.saveTransportConfig(this.business.id, this.transportFields).subscribe({ next: fields => { this.transportFields = fields; this.transportSettingsSaving = false; this.transportSettingsSaved = true; }, error: () => { this.transportSettingsSaving = false; this.transportSettingsError = true; } }); }

  paymentFieldLabel(key: string): string { const labels: Record<string, string> = { paidBy: 'f017.paidBy', upiId: 'f017.upiId', transactionReference: 'f017.transactionReference', lastFour: 'f017.lastFour', approvalCode: 'f017.approvalCode', reference: 'f017.reference', bankName: 'f017.bankName' }; return labels[key] || key; }

  async chooseLogo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.logoErrorKey = '';
    if (!file) return;
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) { this.logoErrorKey = 'business.logoInvalid'; return; }
    this.isProcessingLogo = true;
    try {
      const optimizedLogo = await prepareBusinessLogo(file);
      this.logoFile = optimizedLogo;
      this.removeExistingLogo = false;
      this.setPreview(URL.createObjectURL(optimizedLogo));
    } catch {
      this.logoFile = null;
      this.logoErrorKey = 'business.logoProcessingError';
    } finally {
      this.isProcessingLogo = false;
    }
  }

  removeLogo(): void {
    this.logoFile = null;
    this.setPreview('');
    this.removeExistingLogo = Boolean(this.business?.hasLogo);
  }

  submit(): void {
    if (this.transportConfigAllowed && !this.transportSettingsLoaded) return;
    if (this.form.invalid || this.isSaving || this.isProcessingLogo || this.paymentSettingsSaving || this.numberSettingsSaving || this.transportSettingsSaving || this.logoErrorKey) {
      this.form.markAllAsTouched();
      return;
    }
    const event = { details: this.form.getRawValue(), logo: this.logoFile, removeLogo: this.removeExistingLogo, creationRequestKey: this.creationRequestKey };
    // These settings use separate endpoints from the business PATCH payload. Persist all of them before
    // emitting the main save action so Save changes commits all visible edit settings.
    if (this.business && (this.paymentMethodManagementAllowed || this.transportConfigAllowed)) {
      this.paymentSettingsSaving = true;
      this.paymentSettingsMessage = '';
      this.paymentSettingsError = false;
      this.numberSettingsError = false;
      const saveTransport = () => this.transportConfigAllowed ? this.billsApi.saveTransportConfig(this.business!.id, this.transportFields).subscribe({ next: fields => { this.transportFields = fields; this.paymentSettingsSaving = false; this.saveBusiness.emit(event); }, error: () => { this.paymentSettingsSaving = false; this.transportSettingsError = true; } }) : this.saveBusiness.emit(event);
      const saveNumbers = () => this.paymentMethodManagementAllowed ? this.billsApi.saveNumberConfig(this.business!.id, this.numberConfig).subscribe({ next: config => { this.numberConfig = config; saveTransport(); }, error: () => { this.paymentSettingsSaving = false; this.numberSettingsError = true; } }) : saveTransport();
      if (this.paymentMethodManagementAllowed) this.billsApi.saveMethodConfig(this.business.id, this.paymentFields).subscribe({ next: fields => { this.paymentFields = fields; saveNumbers(); }, error: () => { this.paymentSettingsSaving = false; this.paymentSettingsError = true; } });
      else saveNumbers();
      return;
    }
    this.saveBusiness.emit(event);
  }

  private websiteValidator(control: { value: string }): { [key: string]: boolean } | null {
    if (!control.value) return null;
    try {
      const url = new URL(control.value);
      return ['http:', 'https:'].includes(url.protocol) ? null : { website: true };
    } catch { return { website: true }; }
  }

  private setPreview(url: string): void {
    if (this.previewUrl.startsWith('blob:')) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = url;
  }

  private emptyTransportFields(): Record<string, Record<string, boolean>> { return Object.fromEntries(this.transportTypes.map(item => [item.type, Object.fromEntries(item.fields.map(field => [field, false]))])); }
}
