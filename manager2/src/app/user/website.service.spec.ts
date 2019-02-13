import { TestBed } from '@angular/core/testing';

import { WebsiteService } from './website.service';

describe('WebsiteService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: WebsiteService = TestBed.get(WebsiteService);
    expect(service).toBeTruthy();
  });
});
