import { TestBed } from '@angular/core/testing';

import { GroupsService } from './groups.service';

describe('GroupsService', () => {
    beforeEach(() => TestBed.configureTestingModule({}));

    it('should be created', () => {
        const service: GroupsService = TestBed.inject(GroupsService);
        expect(service).toBeTruthy();
    });
});
