import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WorkspaceService } from './workspace.service';

describe('WorkspaceService F007', () => {
  let service: WorkspaceService;
  let http: HttpTestingController;
  const apiBase = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
    ? `https://${window.location.hostname === '::1' ? '[::1]' : window.location.hostname}:3000`
    : window.location.origin;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(WorkspaceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads owned and Working At businesses separately and combines selectable workspaces', () => {
    service.loadWorkspaces().subscribe();
    const owned = http.expectOne(`${apiBase}/workspaces`);
    const workingAt = http.expectOne(`${apiBase}/workspaces/working-at`);
    expect(owned.request.withCredentials).toBeTrue();
    expect(workingAt.request.withCredentials).toBeTrue();
    owned.flush({ success: true, data: { userId: 'u1', setupChoice: 'personal', workspaces: [
      { id: 'personal', kind: 'personal', name: 'Personal' },
      { id: 'b1', kind: 'business', legalName: 'Owned business', hasLogo: false },
    ] } });
    workingAt.flush({ success: true, data: { workspaces: [
      { id: 'b2', kind: 'business', legalName: 'Member business', hasLogo: true },
    ] } });

    expect(service.myBusinesses().map(item => item.id)).toEqual(['b1']);
    expect(service.workingAtBusinesses().map(item => item.id)).toEqual(['b2']);
    expect(service.workingAtBusinesses()[0].workingAt).toBeTrue();
    expect(service.workspaces().map(item => item.id)).toEqual(['personal', 'b1', 'b2']);
    expect(service.workingAtLoading()).toBeFalse();
  });

  it('keeps owned businesses usable and reports a Working At failure', () => {
    service.loadWorkspaces().subscribe();
    http.expectOne(`${apiBase}/workspaces`).flush({ success: true, data: { userId: 'u1', setupChoice: 'personal', workspaces: [
      { id: 'personal', kind: 'personal', name: 'Personal' },
      { id: 'b1', kind: 'business', legalName: 'Owned business', hasLogo: false },
    ] } });
    http.expectOne(`${apiBase}/workspaces/working-at`).flush({}, { status: 503, statusText: 'Unavailable' });

    expect(service.myBusinesses().map(item => item.id)).toEqual(['b1']);
    expect(service.workspaces().map(item => item.id)).toEqual(['personal', 'b1']);
    expect(service.workingAtBusinesses()).toEqual([]);
    expect(service.workingAtError()).toBeTrue();
    expect(service.workingAtLoading()).toBeFalse();
  });
});
