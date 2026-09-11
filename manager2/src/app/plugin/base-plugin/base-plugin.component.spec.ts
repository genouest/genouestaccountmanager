import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { BasePluginComponent } from './base-plugin.component';

describe('BasePluginComponent', () => {
    let component: BasePluginComponent;
    let fixture: ComponentFixture<BasePluginComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            declarations: [ BasePluginComponent ]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(BasePluginComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
