import { TestBed } from '@angular/core/testing';

import { TpserviceService } from './tpservice.service';

describe('TpserviceService', () => {
    beforeEach(() => TestBed.configureTestingModule({}));

    it('should be created', () => {
        const service: TpserviceService = TestBed.get(TpserviceService);
        expect(service).toBeTruthy();
    });
});
