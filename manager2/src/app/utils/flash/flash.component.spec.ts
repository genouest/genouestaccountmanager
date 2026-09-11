import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { FlashComponent } from './flash.component';

describe('FlashComponent', () => {
    let component: FlashComponent;
    let fixture: ComponentFixture<FlashComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            declarations: [ FlashComponent ]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(FlashComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
