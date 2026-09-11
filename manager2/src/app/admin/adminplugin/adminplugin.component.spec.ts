import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AdminpluginComponent } from './adminplugin.component';

describe('AdminpluginComponent', () => {
    let component: AdminpluginComponent;
    let fixture: ComponentFixture<AdminpluginComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            declarations: [ AdminpluginComponent ]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(AdminpluginComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
