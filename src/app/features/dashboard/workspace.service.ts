import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { catchError, finalize, forkJoin, map, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { ApiResponse, BusinessDetails, BusinessTypeOption, Workspace, WorkspaceOverview, WorkspaceSetupChoice, WorkingAtWorkspacesResponse } from './workspace.models';
import { apiBaseUrl } from '../../app-config';

const API_BASE = apiBaseUrl();
const ACTIVE_WORKSPACE_KEY = 'billforbill.activeWorkspace';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  readonly workspaces = signal<Workspace[]>([]);
  readonly myBusinesses = signal<Workspace[]>([]);
  readonly workingAtBusinesses = signal<Workspace[]>([]);
  readonly workingAtLoading = signal(false);
  readonly workingAtError = signal(false);
  readonly activeWorkspaceId = signal('personal');
  private userId = '';
  private personalWorkspace: Workspace = { id: 'personal', kind: 'personal', name: 'Personal' };
  private readonly logoUrls = new Map<string, Observable<SafeUrl>>();

  constructor(private readonly http: HttpClient, private readonly sanitizer: DomSanitizer) {}

  loadWorkspaces(): Observable<WorkspaceOverview> {
    this.workingAtBusinesses.set([]);
    this.workingAtLoading.set(true);
    this.workingAtError.set(false);
    return forkJoin({
      overview: this.http.get<ApiResponse<WorkspaceOverview>>(`${API_BASE}/workspaces`, { withCredentials: true }).pipe(map(response => response.data)),
      workingAt: this.requestWorkingAt().pipe(
        catchError(() => { this.workingAtError.set(true); return of([] as Workspace[]); }),
        finalize(() => this.workingAtLoading.set(false)),
      ),
    }).pipe(
      tap(({ overview, workingAt }) => {
        this.workingAtBusinesses.set(workingAt);
        this.applyOverview(overview);
      }),
      map(({ overview }) => overview),
    );
  }

  retryWorkingAt(): Observable<Workspace[]> {
    this.workingAtLoading.set(true);
    this.workingAtError.set(false);
    return this.requestWorkingAt().pipe(
      tap(workspaces => {
        this.workingAtBusinesses.set(workspaces);
        this.syncWorkspaceList();
        this.restoreSavedWorkspace();
      }),
      catchError(error => { this.workingAtError.set(true); return throwError(() => error); }),
      finalize(() => this.workingAtLoading.set(false)),
    );
  }

  saveSetupChoice(choice: WorkspaceSetupChoice): Observable<WorkspaceSetupChoice> {
    return this.http.put<ApiResponse<{ setupChoice: WorkspaceSetupChoice }>>(
      `${API_BASE}/workspaces/setup-choice`, { choice }, { withCredentials: true },
    ).pipe(map((response) => response.data.setupChoice));
  }

  listBusinessTypes(): Observable<BusinessTypeOption[]> {
    return this.http.get<ApiResponse<BusinessTypeOption[]>>(`${API_BASE}/businesses/business-types`, { withCredentials: true })
      .pipe(map(response => response.data));
  }

  createBusiness(details: BusinessDetails, requestKey: string): Observable<Workspace> {
    return this.http.post<ApiResponse<Workspace>>(`${API_BASE}/businesses`, details, { withCredentials: true, headers: new HttpHeaders({ 'Idempotency-Key': requestKey }) })
      .pipe(map((response) => response.data));
  }

  updateBusiness(businessId: string, details: BusinessDetails): Observable<Workspace> {
    return this.http.patch<ApiResponse<Workspace>>(`${API_BASE}/businesses/${encodeURIComponent(businessId)}`, details, { withCredentials: true })
      .pipe(map((response) => response.data));
  }

  uploadLogo(businessId: string, file: File): Observable<void> {
    const headers = new HttpHeaders({
      'Content-Type': file.type,
      'X-File-Name': encodeURIComponent(file.name),
    });
    return this.http.put<ApiResponse<{ businessId: string }>>(
      `${API_BASE}/businesses/${encodeURIComponent(businessId)}/logo`, file, { headers, withCredentials: true },
    ).pipe(tap(() => this.logoUrls.delete(businessId)), map(() => undefined));
  }

  deleteLogo(businessId: string): Observable<void> {
    return this.http.delete<ApiResponse<{ deleted: boolean }>>(
      `${API_BASE}/businesses/${encodeURIComponent(businessId)}/logo`, { withCredentials: true },
    ).pipe(tap(() => this.logoUrls.delete(businessId)), map(() => undefined));
  }

  businessLogoUrl(businessId: string): Observable<SafeUrl> {
    const cached = this.logoUrls.get(businessId);
    if (cached) return cached;
    const logoUrl = this.http.get(`${API_BASE}/businesses/${encodeURIComponent(businessId)}/logo`, {
      withCredentials: true, responseType: 'blob',
    }).pipe(
      map((logo) => this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(logo))),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.logoUrls.set(businessId, logoUrl);
    return logoUrl;
  }

  selectWorkspace(workspaceId: string): void {
    if (!this.workspaces().some((workspace) => workspace.id === workspaceId)) return;
    this.activeWorkspaceId.set(workspaceId);
    this.saveActiveWorkspace(workspaceId);
  }

  addOrUpdateWorkspace(workspace: Workspace): void {
    const list = workspace.workingAt ? this.workingAtBusinesses() : this.myBusinesses();
    const index = list.findIndex(item => item.id === workspace.id);
    const next = [...list];
    if (index === -1) next.push(workspace);
    else next[index] = workspace;
    if (workspace.workingAt) this.workingAtBusinesses.set(next);
    else this.myBusinesses.set(next);
    this.syncWorkspaceList();
  }

  private applyOverview(overview: WorkspaceOverview): void {
    this.userId = overview.userId;
    this.personalWorkspace = overview.workspaces.find(workspace => workspace.kind === 'personal') || this.personalWorkspace;
    this.myBusinesses.set(overview.workspaces.filter(workspace => workspace.kind === 'business'));
    this.syncWorkspaceList();
    this.restoreSavedWorkspace();
  }

  private requestWorkingAt(): Observable<Workspace[]> {
    return this.http.get<ApiResponse<WorkingAtWorkspacesResponse>>(`${API_BASE}/workspaces/working-at`, { withCredentials: true })
      .pipe(map(response => response.data.workspaces.map(workspace => ({ ...workspace, workingAt: true }))));
  }

  private syncWorkspaceList(): void {
    this.workspaces.set([this.personalWorkspace, ...this.myBusinesses(), ...this.workingAtBusinesses()]);
  }

  private restoreSavedWorkspace(): void {
    const savedWorkspaceId = this.readActiveWorkspace();
    const available = this.workspaces().some(workspace => workspace.id === savedWorkspaceId);
    const restored = savedWorkspaceId && available ? savedWorkspaceId : 'personal';
    this.activeWorkspaceId.set(restored);
    if (restored !== savedWorkspaceId && !this.workingAtError()) this.saveActiveWorkspace(restored);
  }

  private storageKey(): string {
    return `${ACTIVE_WORKSPACE_KEY}.${this.userId}`;
  }

  private readActiveWorkspace(): string | null {
    if (!this.userId) return null;
    try { return localStorage.getItem(this.storageKey()); } catch { return null; }
  }

  private saveActiveWorkspace(workspaceId: string): void {
    if (!this.userId) return;
    try { localStorage.setItem(this.storageKey(), workspaceId); } catch { /* The current selection still works in memory. */ }
  }
}
