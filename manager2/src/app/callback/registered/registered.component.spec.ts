import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { RegisteredComponent } from './registered.component';

describe('RegisteredComponent', () => {
    let component: RegisteredComponent;
    let fixture: ComponentFixture<RegisteredComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            declarations: [ RegisteredComponent ]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(RegisteredComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
