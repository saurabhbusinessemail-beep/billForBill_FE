import { PhoneIdentity } from '../../shared/phone/phone.models';

export interface Envelope<T> { success: boolean; data: T; }
export interface Person extends PhoneIdentity { userId: string; name: string; generatedNameNumber: number | null; photoUrl: string; accountStatus: string; teamCount?: number; joinedAt?: string; }
export interface BusinessAuthorization { isOwner: boolean; permissionKeys: string[]; }
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number; hasNextPage: boolean; authorization?: BusinessAuthorization; }
export interface TeamMemberPreview { name: string; generatedNameNumber: number | null; photoUrl: string; }
export interface Team { id: string; name: string; description: string; memberCount: number; memberPreviews?: TeamMemberPreview[]; permissionCount: number; }
export interface Permission { key: string; category: string; labelKey: string; descriptionKey: string; granted: boolean; }
export interface Overview { counts: { people: number; teams: number; permissions: number; products?: number; categories?: number; attributes?: number; units?: number; taxes?: number }; authorization?: BusinessAuthorization; }
export interface TeamPeople { members: Person[]; eligible: Person[]; authorization?: BusinessAuthorization; }
