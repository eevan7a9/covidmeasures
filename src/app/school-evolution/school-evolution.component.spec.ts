import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolEvolutionComponent } from './school-evolution.component';

describe('SchoolEvolutionComponent', () => {
  let component: SchoolEvolutionComponent;
  let fixture: ComponentFixture<SchoolEvolutionComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SchoolEvolutionComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SchoolEvolutionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
