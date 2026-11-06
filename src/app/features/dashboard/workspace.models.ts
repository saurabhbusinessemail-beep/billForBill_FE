export type WorkspaceKind = 'personal' | 'business';
export type WorkspaceSetupChoice = 'personal' | 'new-business';

export interface Workspace {
  id: string;
  kind: WorkspaceKind;
  name?: string;
  legalName?: string;
  businessTypeId?: string | null;
  registrationId?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  hasLogo?: boolean;
  workingAt?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkspaceOverview {
  userId: string;
  setupChoice: WorkspaceSetupChoice | null;
  workspaces: Workspace[];
}

export interface WorkingAtWorkspacesResponse {
  workspaces: Workspace[];
}

export interface BusinessDetails {
  legalName: string;
  businessTypeId: string;
  registrationId: string;
  phone: string;
  email: string;
  website: string;
  address: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}
