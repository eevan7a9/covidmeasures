import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Chart } from 'chart.js';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from "@angular/router";
import { Location } from '@angular/common'; 
import moment from 'moment'
import { FormBuilder, FormGroup } from '@angular/forms';
import * as typeformEmbed from '@typeform/embed';

import { mobileWidth, monthNames, getCountryNameByAlpha, getAlpha3FromAlpha2,
         getChildrenNoSchool, getCountryPopulation, createEvolutionChart, aws } from '../utils';

interface Country {
  value: string;
  viewValue: string;
}

@Component({
  selector: 'app-country',
  templateUrl: './country.component.html',
  styleUrls: ['./country.component.css']
})
export class CountryComponent implements OnInit {
 
  public calendarForm: FormGroup;
  
  public isMobile: boolean;
  public countryView = "USA";
  public currentCountryName = "United States of America";
  public countryAllCasesCTX: Chart;
  public countryList: Country[];

  public evolutionRange: {from:string, to:string} = {from: 'default', to: 'default'};
  
  public schoolClosure = {
    status: 'No Data',
    date: '',
    impacted_children: 0,
    years: 0,
    message: 'Educational Facilities Closed On',
    current_coverage: '',
    start_reopening: '',
    end: '',
    comment: ''
  };
  public lockdown = {
    status: 'No Data',
    date: '',
    current_coverage: '',
    restriction_type: '',
    start_reopening: '',
    end: '',
    comment: ''
  };
  public businessClosure = {
    status: 'No Data',
    date: '',
    days: 0,
    start_reopening_business: '', 
    end_business: ''
  };
  public travel = {
    start: '',
    end: '',
    status: 'No Data',
  };
  public countryImpactedPeople: number;
  public countryCumulatedYears: number;

  public currentDeathRatio: number;
  public totalDeathRatio: number;

  public statsDivider = 1;

  public options = ['In Total', 'Per COVID-19 Death', 'Per COVID-19 Case'];
  public currentOption = this.options[0];

  public evolutionUpdatedOn: string;

  public impactHeaders = ['Measure', 'Impact', 'Description', 'Source'];
  public impactTable = [];
  private impactData: any;

  private evolution: any;
  private schoolClosureData: any;
  private lockdownData: any;
  private travelData: any;

  public severityMeasures: Chart;

  constructor(
    private titleService: Title,
    private http: HttpClient,
    private activatedRoute: ActivatedRoute,
    private location: Location,
    private formBuilder: FormBuilder
  ) { }

  async ngOnInit() {
    this.calendarForm = this.formBuilder.group({
      dateRange: null
    });

    this.titleService.setTitle('Country Overview: COVID-19 Statistics and Government Measures');
    this.isMobile = window.innerWidth > mobileWidth ? false : true;

    this.evolution = (await this.http.get(`${aws}/evolution.json`).toPromise() as any);
    this.schoolClosureData = (await this.http.get(`${aws}/school_closure.json`).toPromise() as any);
    this.lockdownData = (await this.http.get(`${aws}/lockdown.json`).toPromise() as any);
    this.impactData = (await this.http.get(`${aws}/community_impacts.json`).toPromise() as any);
    this.travelData = (await this.http.get(`${aws}/international_flights.json`).toPromise() as any);
    this.setImpactTable();

    this.evolutionUpdatedOn = this.changeDateFormat(this.evolution.dates[this.evolution.dates.length - 1]);

    this.setStatsAndStatuses(this.countryView);

    this.countryList = [];
    for (const alpha of Object.keys(this.evolution.data)) {
      this.countryList.push({
        "value": alpha,
        "viewValue": this.evolution.data[alpha].name.split('_').join(' ')
      });
    }

    const labels = this.evolution.dates.map(date => this.changeDateFormat(date));
    const data = this.getDataSets(
      this.evolution.data.USA.cases, this.evolution.data.USA.deaths, labels,
      this.evolution.data.USA.lockdown, this.evolution.data.USA.school_closure
    );

    // we get start & end date for calendar range
    const startDate = moment(new Date(data.labels[0])).format('MM/DD/YYYY')
    const endDate = moment(new Date(data.labels[data.labels.length - 1])).format('MM/DD/YYYY')
     // we update the value of calendar range
    this.calendarForm.controls['dateRange'].setValue(`${startDate} - ${endDate}`)

    const dataSets = [
      {
        label: "Cases", backgroundColor: "rgba(52,107,186,0.3)", borderColor: "#346bb6",
        fill: true, data: data.cases, yAxisID: 'people'
      },
      {
        label: "Deaths", backgroundColor: "rgba(206,43,51,0.3)", borderColor: "#ce2b33",
        fill: true, data: data.deaths, yAxisID: 'people'
      },
      {
        label: "Lockdown", backgroundColor: "rgba(174, 113, 240, 0.4)", borderColor: "rgba(174, 113, 240, 0)",
        fill: true, data: data.lockdown, yAxisID: 'severity', pointRadius: 0, pointHoverRadius: 0
      },
      {
        label: "School Closure", backgroundColor: "rgba(166, 230, 154, 0.2)", borderColor: "rgba(166, 230, 154, 0)",
        fill: true, data: data.school, yAxisID: 'severity', pointRadius: 0, pointHoverRadius: 0
      }
    ]

    // One country cases evolution chart
    this.countryAllCasesCTX = createEvolutionChart(
      (document.getElementById("countryChartAllCases") as any).getContext("2d"),
      data.labels,
      dataSets,
      true,
      true,
      false, // we make aspect ratio to false this prevents the chart from growing too much
    );
    
    const alpha3 = this.activatedRoute.snapshot.paramMap.get('alpha3');
    if (alpha3) {
      this.countryChangeView(alpha3);
    } else {
      try {
        const ip = await this.http.get('https://json.geoiplookup.io/api').toPromise();
        this.countryView = getAlpha3FromAlpha2((ip as any).country_code);
      } catch (_err) {
        this.countryView = 'USA';
      }
      this.location.go('/country/'+this.countryView)
    }

    this.currentCountryName = getCountryNameByAlpha(this.countryView);
    this.setTotalDeathRatio();

    this.setWidget();
  }

  public evolutionRangeChanged() { // if date range picker value is changed
    if (Array.isArray(this.calendarForm.controls.dateRange.value)) {
      const start = moment(this.calendarForm.controls.dateRange.value[0]).format('DD/MM/YYYY')
      const end = moment(this.calendarForm.controls.dateRange.value[1]).format('DD/MM/YYYY')
      
      this.evolutionRange.from = this.changeDateFormat(start)
      this.evolutionRange.to = this.changeDateFormat(end)

      const datasets = this.getDataSets(
        this.evolution.data[this.countryView].cases,
        this.evolution.data[this.countryView].deaths,
        this.evolution.dates.map(date => this.changeDateFormat(date)),
        this.evolution.data[this.countryView].lockdown,
        this.evolution.data[this.countryView].school_closure
      )

      this.countryAllCasesCTX.data.datasets[0].data  = datasets['cases'];
      this.countryAllCasesCTX.data.datasets[1].data = datasets['deaths'];
      this.countryAllCasesCTX.data.datasets[2].data = datasets['lockdown'];
      this.countryAllCasesCTX.data.datasets[3].data = datasets['school'];
      this.countryAllCasesCTX.data.labels = datasets['labels'];
      this.countryAllCasesCTX.update();
    }
  }

  private getDataSets(activeCases: number[], deaths: number[], labels: string[], lockdown: number[], school_closure: number[]) {
    let shortenCases = [...activeCases];
    let shortenDeaths = [...deaths];
    let shortenLabels = [...labels];
    let shortenLockdown = [...lockdown];
    let shortenSchool = [...school_closure];

    if (this.evolutionRange.from === 'default' && this.evolutionRange.to === 'default') {
      // get the index of the first death.
      // the graph will start at the first death
      const firstDeathIndex = shortenDeaths.findIndex(x => x)
      shortenCases = shortenCases.slice(firstDeathIndex, shortenCases.length);
      shortenDeaths = shortenDeaths.slice(firstDeathIndex, shortenDeaths.length);
      shortenLabels = shortenLabels.slice(firstDeathIndex, shortenLabels.length);
      shortenLockdown = shortenLockdown.slice(firstDeathIndex, shortenLockdown.length);
      shortenSchool = shortenSchool.slice(firstDeathIndex, shortenSchool.length);
    } else {
      // if evolutionRange has date. we get the first and last index of labels
      const findStart = shortenLabels.findIndex(date => date == this.evolutionRange.from);
      const findEnd = shortenLabels.findIndex(date => date == this.evolutionRange.to);
      // we check if the index actually exists
      const startIndex = findStart > -1 ? findStart : 0;
      const endIndex = findEnd > -1 ? findEnd : shortenLabels.length;

      shortenCases = shortenCases.slice(startIndex, endIndex+1);
      shortenDeaths = shortenDeaths.slice(startIndex, endIndex+1);
      shortenLabels = shortenLabels.slice(startIndex, endIndex+1);
      shortenLockdown = shortenLockdown.slice(startIndex, endIndex+1);
      shortenSchool = shortenSchool.slice(startIndex, endIndex+1);
    }
    this.currentDeathRatio = shortenDeaths.reduce((a,b) => a + b)/shortenCases.reduce((a,b) => a + b);

    return {
      'cases': shortenCases, 'deaths': shortenDeaths, 'labels': shortenLabels,
      'lockdown': shortenLockdown, 'school': shortenSchool
    }
  }

  private setStatsAndStatuses(alpha3: string) {
    const schoolCountry = this.getCountry(this.schoolClosureData.countries, alpha3);
    this.schoolClosure.status = schoolCountry.status;
    this.schoolClosure.message = schoolCountry.status === 'Re-opened' ? 'Educational Facilities Re-opened Since' : 'Educational Facilities Closed On';
    this.schoolClosure.date = schoolCountry.status === 'Re-opened' ? schoolCountry.end : schoolCountry.start;
    this.schoolClosure.current_coverage = schoolCountry.current_coverage
    this.schoolClosure.start_reopening = schoolCountry.start_reopening
    this.schoolClosure.end = schoolCountry.end
    this.schoolClosure.comment = schoolCountry.comment

    const affectedChildren = getChildrenNoSchool(alpha3)*schoolCountry.current_children_no_school;
    this.schoolClosure.impacted_children =
      Math.floor((affectedChildren)/this.statsDivider);
    this.schoolClosure.years = (
      this.getMissedDays(schoolCountry.start, schoolCountry.end)*affectedChildren) / (365*this.statsDivider
    );

    const lockdownCountry = this.getCountry(this.lockdownData.countries, alpha3);
    this.lockdown.status = lockdownCountry.status;
    this.lockdown.date = lockdownCountry.start;
    this.lockdown.current_coverage = lockdownCountry.current_coverage
    this.lockdown.restriction_type = lockdownCountry.restriction_type
    this.lockdown.start_reopening = lockdownCountry.start_reopening
    this.lockdown.end = lockdownCountry.end
    this.lockdown.comment = lockdownCountry.comments

    this.businessClosure.status = lockdownCountry.status_business;
    this.businessClosure.date = lockdownCountry.start_business_closure;
    this.businessClosure.days =
      this.getMissedDays(lockdownCountry.start_business_closure, lockdownCountry.end_business_closure);
    this.businessClosure.start_reopening_business = lockdownCountry.start_reopening_business
    this.businessClosure.end_business = lockdownCountry.end_business

    const travelCountry = this.getCountry(this.travelData.countries, alpha3);
    this.travel.start = travelCountry.start;
    this.travel.end = travelCountry.end;
    this.travel.status = travelCountry.status;

    const affectedPopulation = getCountryPopulation(alpha3)*lockdownCountry.current_population_impacted;
    this.countryImpactedPeople = Math.floor(affectedPopulation/this.statsDivider);
    this.countryCumulatedYears =
      (this.getMissedDays(lockdownCountry.start, lockdownCountry.end)*affectedPopulation) / (365*this.statsDivider);

    this.setImpactTable();
  }

  /**
   * computes days missed
   * @param start start of the restrictions
   * @param end end of the restrictions
   */
  private getMissedDays(start: string, end: string) {
    if (start === '') {
      return 0
    }
    const start_data = new Date(start);
    const today = new Date()
    const planedEnd = end === '' ? today : new Date(end);
    const end_date = today < planedEnd ? today : planedEnd;
    return Math.floor((end_date.getTime()-start_data.getTime())/(1000*60*60*24));
  }

  private getCountry(countries, alpha3) {
    for (const country of countries) {
      if (country.alpha3 === alpha3) {
        return country;
      }
    }
  }

  public countryChangeView(value: string) {
    this.countryView = value;
    this.setTotalDeathRatio();
    
    this.evolutionRange = {from: 'default', to: 'default'}; // we make evolutionRange to default
    this.location.go('/country/'+value) // we change the url: /country/value:
    this.currentCountryName = getCountryNameByAlpha(value);
    this.setStatsAndStatuses(value);

    const datasets = this.getDataSets(
      this.evolution.data[value].cases,
      this.evolution.data[value].deaths,
      this.evolution.dates.map(date => this.changeDateFormat(date)),
      this.evolution.data[value].lockdown,
      this.evolution.data[value].school_closure
    )
    // we get start & end date for calendar range
    const startDate = moment(new Date(datasets.labels[0])).format('MM/DD/YYYY')
    const endDate = moment(new Date(datasets.labels[datasets.labels.length - 1])).format('MM/DD/YYYY')
    // we update the value of calendar range
    this.calendarForm.controls['dateRange'].setValue(`${startDate} - ${endDate}`)

    for (const country of this.countryList) {
      if (country.value === value) {

        this.countryAllCasesCTX.data.datasets[0].data  = datasets['cases'];
        this.countryAllCasesCTX.data.datasets[1].data = datasets['deaths'];
        this.countryAllCasesCTX.data.datasets[2].data = datasets['lockdown'];
        this.countryAllCasesCTX.data.datasets[3].data = datasets['school'];
        this.countryAllCasesCTX.data.labels = datasets['labels'];
        this.countryAllCasesCTX.update();
        return;
      }
    }
  }

  /**
   * Transforms a european format date to universal
   * Ex: 15/01/2020 to 15 January 2020
   * @param date to change
   */
  private changeDateFormat(date: string) {
    const data = date.split('/');
    return `${data[0]} ${monthNames[parseInt(data[1])-1]} ${data[2]}` 
   }

   public changeViewOption(value: string) {
    this.currentOption = value;
    if (value === 'In Total') {
      this.statsDivider = 1.0;
    } else if (value === 'Per COVID-19 Death') {
      this.statsDivider = this.evolution.data[this.countryView].deaths.reduce((a, b) => a+b);
    } else {
      this.statsDivider = this.evolution.data[this.countryView].cases.reduce((a, b) => a+b);
    }
    this.setStatsAndStatuses(this.countryView);
   }

  private async setImpactTable() {
    this.impactTable = [];
    for (const impact of this.impactData) {
      if (impact.alpha3 === undefined) {
        continue;
      }

      if (impact.alpha3[0] === 'WRD' || impact.alpha3[0] === this.countryView) {
        this.impactTable.push(impact);
      }
    }
  }

  private setTotalDeathRatio() {
    this.totalDeathRatio = this.evolution.data[this.countryView].deaths.reduce((a,b) => a + b) /
      this.evolution.data[this.countryView].cases.reduce((a,b) => a + b);
  }

  private setWidget() {
    document.getElementById('addImpact').addEventListener('click', function () {
      typeformEmbed.makePopup('https://admin114574.typeform.com/to/uTHShl', {
        hideFooter: true,
        hideHeaders: true,
        opacity: 0
      }).open();
    })
  }

}
