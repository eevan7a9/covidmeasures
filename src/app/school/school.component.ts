import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Title } from "@angular/platform-browser";
import * as typeformEmbed from '@typeform/embed';

import { aws, mobileWidth, getRegionByAlpha, getCountryNameByAlpha, getChildrenNoSchool } from '../utils';
import * as text from '../data/texts/school_closure';

interface Location {
  value: string;
  viewValue: string;
}

interface CovidCategories {
  value: string;
}

enum ChildrenCases {
  PerCovid = 'perCovidCases',
  PerDeaths = 'COVID-19 Death',
  Total = 'Total'
}

@Component({
  selector: 'app-school',
  templateUrl: './school.component.html',
  styleUrls: ['./school.component.css']
})
export class SchoolComponent implements OnInit {
  public isMobile: boolean;
  public readMore = false;

  /** Texts */
  public TEXT_P1: string;
  public TEXT_P2: string;
  public TEXT_P3: string;
  public school_graph_1_below_last_update: string;
  public school_graph_2_below: string;
  public school_graph_2_below_last_update: string;
/** Texts end*/

  public locations: Location[] = [
    {value: 'World', viewValue: 'World'},
    {value: 'Northern America', viewValue: 'North America'},
    {value: 'Europe', viewValue: 'Europe'},
    {value: 'Asia', viewValue: 'Asia'},
    {value: 'Africa', viewValue: 'Africa'},
    {value: 'Oceania', viewValue: 'Oceania'},
    {value: 'Latin America and the Caribbean', viewValue: 'Latin America and the Caribbean'},
  ]

  public covidCategories: CovidCategories[] = [
    {value: 'COVID-19 Death'},
    {value: 'Total'}
  ]

  public impactHeaders = ['Impact', 'Description', 'Link to Lockdown', 'Countries Impacted', 'Source'];
  public impactTable = [];
  public p: number = 1;
  public impactCollection: any[];

  public currentCovidCategory = 'COVID-19 Death';

  public numberChildrenImpacted: number;
  public averageDaysMissed: number;

  public schoolClosureRegion = 'World';
  public covidVSSchoolRegion = 'World';

  public impactedChildren: number;
  public impactedChildrenPer: number;
  public schoolYearsMissedPer: number;

  public perCovidActive = false;

  public covidChildrenCases: string = 'COVID-19 Death';

  public schoolClosureFull = [];
  public schoolClosure = [];
  public schoolClosureTableUpdatedOn: string;

  private covidByContinent = {
    "Europe": { "activeCases": 0, "deaths": 0 },
    "Asia": { "activeCases": 0, "deaths": 0 },
    "Africa": { "activeCases": 0, "deaths": 0 },
    "Northern America": { "activeCases": 0, "deaths": 0 },
    "Latin America and the Caribbean": { "activeCases": 0, "deaths": 0 },
    "Oceania": { "activeCases": 0, "deaths": 0 },
    "Antarctica": { "activeCases": 0, "deaths": 0 },
    "World": { "activeCases": 0, "deaths": 0 }
  }

  public statsHeaders = [
    {title:"Country", sortable:true}, {title:"Impacted Children", sortable:true}, 
    {title:"Start", sortable:true}, {title:"End", sortable:true}, 
    {title:"Duration", sortable:true}, {title:"Closure Status", sortable:false}];

  public filterCountry: string;
  // 'Country', 'Impacted Children', 'start', 'end', 'duration'
  public sortStatus = {
    country: {
      active:true,
      asc: true
    },
    children : {
      active:false,
      asc: false
    },
    start : {
      active:false,
      asc: false
    },
    end : {
      active:false,
      asc: false
    },
    duration : {
      active:false,
      asc: false
    }
  };

  public schoolClosureData: any;

  public isClientReady: boolean = false;

  private navTopDistance: number;

  constructor(
    private titleService: Title,
    private http: HttpClient,
    private changeDetector: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    this.titleService.setTitle('School Closure: Citizens Tracking School Closures');
    this.isMobile = window.innerWidth > mobileWidth ? false : true;

    this.schoolClosureData = await this.http.get(`${aws}/school_closure.json`).toPromise();
    this.schoolClosureTableUpdatedOn = this.schoolClosureData.updatedOn;
    this.setTexts();
    await this.setCurrentDeathEvolution();
    this.setLockdownImpactStatistics();
    this.numberChildrenImpacted = Math.floor(this.getRegionChildrenPopulation(this.schoolClosureRegion));
    this.averageDaysMissed = this.getAverageDaysMissedPerRegion('World');
    this.covidVSSchoolChangeRegion('World');
    this.setSchoolClosure();
    this.setSurveyWidget();

    this.isClientReady = true;
    this.changeDetector.detectChanges();
  }

  private setTexts() {
    this.TEXT_P1 = text.default.p1;
    this.TEXT_P2 = text.default.p2;
    this.TEXT_P3 = text.default.p3;
    this.school_graph_1_below_last_update = text.default.school_graph_1_below_last_update;
    this.school_graph_2_below = text.default.school_graph_2_below;
    this.school_graph_2_below_last_update = text.default.school_graph_2_below_last_update;
  }

  /**
   * Gets the average number of school days missed for a region.
   * @param region name of a continent or 'World'
   */
  private getAverageDaysMissedPerRegion(region = 'World') {
    let countries = this.getCountriesByRegion(region);
    const missedDays = countries.map(country => this.getMissedDaysPerCountry(country));
    const reducer = (acc: number, currVal: number) => {return currVal + acc};
    return Math.floor(missedDays.reduce(reducer)/missedDays.filter(
      days => { return days > 0 ? true: false }
    ).length);
  }

  // TODO unify the desktop and mobile versions
  public changeCovidActiveDeath(category?: string) {
    // if (category) {
    //   this.currentCovidCategory = category;
    // }

    // this.perCovidActive = !this.perCovidActive;
    if ((<any>Object).values(ChildrenCases).includes(category)) {
      this.covidChildrenCases = category;
      this.covidVSSchoolChangeRegion(this.covidVSSchoolRegion);
    }

  }

  /**
   * computes the school days missed in a specific country
   * @param country country data
   */
  private getMissedDaysPerCountry(country: any) {
    if (country.start === '' || country.start === null) {
      return 0
    }
    const start = new Date(country.start);
    const today = new Date()
    const planedEnd = country.end === '' ? today : new Date(country.end);
    const end = today < planedEnd ? today : planedEnd;
    return Math.floor((end.getTime()-start.getTime())/(1000*60*60*24));
  }

  public schoolClosureChangeLocation(region: string) {
    this.schoolClosureRegion = region;
    this.numberChildrenImpacted = Math.floor(this.getRegionChildrenPopulation(region));
    this.averageDaysMissed = this.getAverageDaysMissedPerRegion(region)
  }

  /**
   * Returns current population in a specific age range and location
   * @param region which population are we interested in
   * @param ranges which age ranges are we interested in
   */
  private getRegionChildrenPopulation(region: string) {
    const countries = this.getCountriesByRegion(region);
    const schoolPopulation = countries.map(
      country => getChildrenNoSchool(country.alpha3)*country.current_children_no_school
    );
    const reducer = (acc: number, currVal: number) => { return currVal + acc };
    return schoolPopulation.reduce(reducer);
  }

  /**
   * Returns a list of countries for a continent or all the countries in the World.
   * @param region name of a continent or 'World'
   */
  private getCountriesByRegion(region: string) {
    let countries;
    if (region === "World") {
      countries = this.schoolClosureData.countries;
    } else {
      countries = this.schoolClosureData.countries.filter(country => {
        return getRegionByAlpha(country.alpha3) === region ? true : false;
      })
    }
    return countries;
  }

  /**
   * Sets the variables related to the missed school days.
   * @param region name of a continent or 'World'
   */
  public covidVSSchoolChangeRegion(region: string) {
    this.covidVSSchoolRegion = region;
    this.impactedChildren = this.getRegionChildrenPopulation(region);
    
    // let divider = this.perCovidActive ? this.covidByContinent[region].activeCases : this.covidByContinent[region].deaths;
    let divider: any;
    switch (this.covidChildrenCases) {

      case ChildrenCases.Total:
        this.impactedChildrenPer = Math.floor(this.getRegionChildrenPopulation(region));
        divider = 1;
        break;
      
      case ChildrenCases.PerCovid:
        divider = this.covidByContinent[region].activeCases;
        this.impactedChildrenPer = Math.floor(this.impactedChildren/divider);
        divider = divider * 365;
        break;

      case ChildrenCases.PerDeaths:
        divider = this.covidByContinent[region].deaths;
        this.impactedChildrenPer = Math.floor(this.impactedChildren/divider);
        divider = divider * 365;
        break;
    
      default:
        break;
    }
    this.averageDaysMissed = this.getAverageDaysMissedPerRegion(region);
    this.schoolYearsMissedPer = Math.floor(
      (this.getAverageDaysMissedPerRegion(region)*this.impactedChildren)/divider
    );
  }

  /**
   * Sets the number of active cases and deaths for every country in the world.
   */
  private async setCurrentDeathEvolution() {
    const data = await this.http.get(`${aws}/evolution.json`).toPromise();
    let region: string;
    for (const alpha3 of Object.keys(data["data"])) {
      region = getRegionByAlpha(alpha3);
      const deaths = data["data"][alpha3]['deaths'].reduce((a, b) => a + b, 0);
      this.covidByContinent[region]["deaths"] += deaths;
      this.covidByContinent['World']["deaths"] += deaths;
    }
  }

  /**
   * Returns the population of a country between 0 and 19 years that are experiencing school closure.
   * @param alpha3 gets the 
   */
  private getCountryChildrenByAlpha(alpha3: string) {
    for (const country of this.schoolClosureData.countries) {
      if (country["alpha3"] === alpha3) {
        return country.current_children_no_school*getChildrenNoSchool(alpha3);
      }
    }
  }

  /**
   * Sets the school closure table
   */
  private setSchoolClosure() {
    let children;
    let duration;
    for (const country of this.schoolClosureData.countries) {
      children = this.getCountryChildrenByAlpha(country['alpha3']);
      duration = this.getMissedDaysPerCountry(country);
      this.schoolClosureFull.push({
        "name": getCountryNameByAlpha(country.alpha3),
        "alpha3": country.alpha3,
        "children": children === 0 ? '' : Math.floor(children),
        "start": this.getDate(country['start']),
        "end": country['end'] !== '' ? this.getDate(country['end']) : this.getDate(country['expected_end']),
        "duration": duration === 0 ? '' : duration,
        "status": country['status']
      })
    }
    this.schoolClosure = this.schoolClosureFull.slice(0, 10);
  }

  public scroll(el: HTMLElement) {
    el.scrollIntoView();
  }

  private getDate(date: string) {
    return date === '' ? '' : (new Date(date)).toDateString();
  }

  /**
   * Search filter for the school closure table
   * @param event object that contains the search word entered by the user.
   */
  applyFilter(event: Event) {
    const search = (event.target as any).value.toLowerCase();
    this.schoolClosure = this.schoolClosureFull.filter(
      row => row.name.toLowerCase().includes(search)
    ).slice(0, 10);
  }

  private async setLockdownImpactStatistics() {
    const data = (await this.http.get(`${aws}/community_impacts.json`).toPromise() as any);
    const impactData = data.filter(impact => impact.measure === 'School Closure');
    for (const row of impactData) {

      if (row.alpha3 === undefined) {
        continue;
      }

      this.impactTable.push({
        "impact": row.impact,
        "desc": row.description,
        "link": row.link,
        "countries": row.alpha3[0] === 'WRD' ? 'World' : getCountryNameByAlpha(row.alpha3[0]),
        "source": row.source
      });
    }
    this.impactCollection = this.impactTable;
  }
  /**
   * Search filter for the impacts table
   * @param event object that contains the search word entered by the user.
   */
  applyImpactFilter(event: Event) {
    const search = (event.target as any).value.toLowerCase();
    this.impactCollection = this.impactTable.filter(row => {
      if(row.countries ? row.countries.toLowerCase().includes(search) : false) return row;
      if(row.impact ? row.impact.toLowerCase().includes(search) : false) return row;
      if(row.desc ? row.desc.toLowerCase().includes(search) : false) return row;
      if(row.link ? row.link.toLowerCase().includes(search) : false) return row;
      if(row.source ? row.source.toLowerCase().includes(search) : false) return row;
    });
  }

    /***
   * Sort Table columns
   * @param string contains value in which column to sort the data by
   */
  public sortTable(sortBy:string) {
    
    const tableStats = this.filterCountry ? 
      this.schoolClosure.length ? this.schoolClosure : JSON.parse(JSON.stringify(this.schoolClosureFull))
      : JSON.parse(JSON.stringify(this.schoolClosureFull));

    for (const key in this.sortStatus) {
      if (this.sortStatus.hasOwnProperty(key)) {
        this.sortStatus[key].active = false;
      }
    } 
    // 'Country', 'Children Impacted ', 'start', 'end', 'duration'
    switch (sortBy) {
      case 'Country':
        this.sortStatus.country.asc ?
          this.schoolClosure = tableStats.sort((a, b) => b.name.localeCompare(a.name)).slice(0, 10) :
          this.schoolClosure = tableStats.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 10)
        this.sortStatus.country.asc = !this.sortStatus.country.asc;
        this.sortStatus.country.active = true;
        break;

      case 'Impacted Children':
        if (this.sortStatus.children.asc ) {
          this.schoolClosure = tableStats.sort((a, b) => b.children - a.children).slice(0, 10);
        }else{
          this.schoolClosure = tableStats.sort((a, b) => {
            if(a.children === "" || a.children === null) return 1;
            if(b.children === "" || b.children === null) return -1;
            if(a.children === b.children) return 0;
            return a.children - b.children;
          }).slice(0, 10);
        }
        this.sortStatus.children.asc = !this.sortStatus.children.asc;
        this.sortStatus.children.active = true;
      break;

      case 'Start':
        if (this.sortStatus.start.asc) { // if Date is already in ascending
          // we sort it to descending
          this.schoolClosure = tableStats.sort((a, b) => {
            const dateA =  a.start ? new Date(a.start).getTime() : 0
            const dateB = b.start ? new Date(b.start).getTime() : 0
            return dateB - dateA;
          }).slice(0,10);
        } else{
          // if date is not ascending? we sort to ascending
          this.schoolClosure = tableStats.sort((a, b) => {
            const dateA =  a.start && a.start != 'Thu Jan 01 1970' ? new Date(a.start).getTime() : 0
            const dateB = b.start && b.start != 'Thu Jan 01 1970' ? new Date(b.start).getTime() : 0
            if(dateA === 0 || dateA === null) return 1;
            if(dateB === 0 || dateB === null) return -1;
            if(dateA === dateB) return 0;
            return dateA - dateB;
          }).slice(0, 10);
        }

        this.sortStatus.start.asc = !this.sortStatus.start.asc;
        this.sortStatus.start.active = true;
        break;
      
      case 'End':
        if (this.sortStatus.end.asc) { // if Date is already in ascending
          // we sort it to descending
          this.schoolClosure = tableStats.sort((a, b) => {
            const dateA =  a.end ? new Date(a.end).getTime() : 0
            const dateB = b.end ? new Date(b.end).getTime() : 0
            return dateB - dateA;
          }).slice(0,10);
        } else{
          // if date is not ascending? we sort to ascending
          this.schoolClosure = tableStats.sort((a, b) => {
            const dateA =  a.end ? new Date(a.end).getTime() : 0
            const dateB = b.end ? new Date(b.end).getTime() : 0
            if(dateA === 0 || dateA === null) return 1;
            if(dateB === 0 || dateB === null) return -1;
            if(dateA === dateB) return 0;
            return dateA - dateB;
          }).slice(0, 10);
        }
        this.sortStatus.end.asc = !this.sortStatus.end.asc;
        this.sortStatus.end.active = true;
        break;
      
      case 'Duration':
        if (this.sortStatus.duration.asc) {
          this.schoolClosure = tableStats.sort((a, b) => b.duration - a.duration).slice(0, 10); 
        }else{
          this.schoolClosure = tableStats.sort((a, b) => {
            if(a.duration === "" || a.duration === null) return 1;
            if(b.duration === "" || b.duration === null) return -1;
            if(a.duration === b.duration) return 0;
            return a.duration - b.duration;
          }).slice(0, 10);
        }
        this.sortStatus.duration.asc = !this.sortStatus.duration.asc;
        this.sortStatus.duration.active = true;
        break;

      default:
        break;
    }
  }

  public openPopUp () {
    typeformEmbed.makePopup('https://admin114574.typeform.com/to/uTHShl', {
      hideFooter: true,
      hideHeaders: true,
      opacity: 0,
      autoClose: 3000
    }).open();
  }

  private setSurveyWidget() {
    const el = document.getElementById('survey');
    typeformEmbed.makeWidget(
      el,
      'https://form.typeform.com/to/ECUQTkgL',
      {
        hideFooter: true,
        hideHeaders: true,
        opacity: 0,
      }
      );
  }
}
