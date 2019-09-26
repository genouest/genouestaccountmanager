import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminpluginComponent } from './adminplugin.component';

describe('AdminpluginComponent', () => {
    let component: AdminpluginComponent;
    let fixture: ComponentFixture<AdminpluginComponent>;

    beforeEach(async(() => {
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
