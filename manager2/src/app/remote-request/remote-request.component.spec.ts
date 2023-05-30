import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RemoteRequestComponent } from './remote-request.component';

describe('RemoteRequestComponent', () => {
  let component: RemoteRequestComponent;
  let fixture: ComponentFixture<RemoteRequestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RemoteRequestComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RemoteRequestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
