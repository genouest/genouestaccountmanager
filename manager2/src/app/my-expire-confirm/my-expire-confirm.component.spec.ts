import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { MyExpireConfirmComponent } from './my-expire-confirm.component';

describe('MyExpireConfirmComponent', () => {
    let component: MyExpireConfirmComponent;
    let fixture: ComponentFixture<MyExpireConfirmComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            declarations: [ MyExpireConfirmComponent ]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(MyExpireConfirmComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
