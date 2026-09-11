import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { PasswordResetConfirmComponent } from './password-reset-confirm.component';

describe('PasswordResetConfirmComponent', () => {
    let component: PasswordResetConfirmComponent;
    let fixture: ComponentFixture<PasswordResetConfirmComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            declarations: [ PasswordResetConfirmComponent ]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(PasswordResetConfirmComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
