import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MyDeleteConfirmComponent } from './my-delete-confirm.component';

describe('MyExpireConfirmComponent', () => {
    let component: MyExpireConfirmComponent;
    let fixture: ComponentFixture<MyExpireConfirmComponent>;

    beforeEach(async(() => {
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
