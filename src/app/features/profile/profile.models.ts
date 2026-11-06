export type AddressLabel = 'home' | 'work' | 'warehouse' | 'shop' | 'other';

export interface ProfileAddress {
  id: string;
  label: AddressLabel;
  contactName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

export interface UserProfile {
  user: { name: string; phoneE164: string; createdAt: string };
  addresses: ProfileAddress[];
}

export type AddressInput = Omit<ProfileAddress, 'id' | 'isDefault'>;
