import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MyDeleteConfirmComponent } from './my-delete-confirm.component';

describe('MyDeleteConfirmComponent', () => {
    let component: MyDeleteConfirmComponent;
    let fixture: ComponentFixture<MyDeleteConfirmComponent>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            declarations: [ MyDeleteConfirmComponent ]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(MyDeleteConfirmComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
