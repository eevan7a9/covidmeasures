import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Title } from "@angular/platform-browser";

import { aws, mobileWidth } from '../utils';

export interface Impact {
  impact: string,
  description: string,
  location: string,
  measure: string,
  source: string,
  link: string
}

@Component({
  selector: 'app-impacts',
  templateUrl: './impacts.component.html',
  styleUrls: ['./impacts.component.css']
})
export class ImpactsComponent implements OnInit {
  public isMobile: boolean;
  public impactHeaders = ['Location', 'Impact', 'Description', 'Measure', 'Source'];
  public impacts: Impact[] = [];

  page: number = 1; // current pagination page
  collection: any[];  

  constructor(
    private titleService: Title,
    private http: HttpClient
  ) { }

  async ngOnInit() {
    this.titleService.setTitle('Impacts: COVID-19 Impacts Worldwide');
    this.isMobile = window.innerWidth > mobileWidth ? false : true;

    const url = `${aws}/impacts.json`;
    this.impacts = (await this.http.get(url).toPromise() as any);
    this.collection = this.impacts
  }

  public applyFilter(event: Event){
    const word = (event.target as any).value.toLowerCase();
    const results = this.impacts.filter(item => {
      if(item.location.toLowerCase().includes(word)) return item;
      if(item.impact.toLowerCase().includes(word)) return item;
      if(item.description.toLowerCase().includes(word)) return item;
      if(item.measure.toLowerCase().includes(word)) return item;
    });
    this.collection = results
  }

}
