import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { UserExtendComponent } from './user-extend.component';

describe('UserExtendComponent', () => {
    let component: UserExtendComponent;
    let fixture: ComponentFixture<UserExtendComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            declarations: [ UserExtendComponent ]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(UserExtendComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
