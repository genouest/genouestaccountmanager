import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { PluginComponent } from './plugin.component';

describe('PluginComponent', () => {
    let component: PluginComponent;
    let fixture: ComponentFixture<PluginComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            declarations: [ PluginComponent ]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(PluginComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
