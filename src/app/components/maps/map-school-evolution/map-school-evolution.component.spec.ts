import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MapSchoolEvolutionComponent } from './map-school-evolution.component';

describe('MapSchoolEvolutionComponent', () => {
  let component: MapSchoolEvolutionComponent;
  let fixture: ComponentFixture<MapSchoolEvolutionComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MapSchoolEvolutionComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MapSchoolEvolutionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
