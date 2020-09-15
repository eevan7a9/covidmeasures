import { Component, OnInit, Input } from "@angular/core";
import * as L from "leaflet";

import { MarkerService } from "../../../_service/map/marker.service";
import { ShapeService } from "../../../_service/map/shape.service";
import { MapTilesService } from "../../../_service/map/map-tiles.service";

const colors = {
  "No data": "#E3E3E3",
  "0": "#28A745",
  "1": "#17A2B8",
  "2": "#EE7F08",
  "3": "#E6595A",
  "default ": "#555",
};

interface Country {
  name: string;
  alpha3: string;
  code: string;
  region: string;
  start: string;
  start_reopening: string;
  school_closure: boolean;
  historical_coverage: string;
  current_children_no_school: number;
  historical_children_no_school: number;
  current_coverage: string;
  status: string;
}

@Component({
  selector: "app-map-school-evolution",
  templateUrl: "./map-school-evolution.component.html",
  styleUrls: ["./map-school-evolution.component.css"],
})
export class MapSchoolEvolutionComponent implements OnInit {
  private map: L.map;
  private info: L.control;
  private legend: L.control;

  public displayDate: Date;
  @Input() countries: Array<Country>;
  @Input() evolutionData: {
    dates: Array<string>;
    data: {};
  };

  constructor(
    private shapeService: ShapeService,
    private mapTiles: MapTilesService
  ) {}
  ngOnInit(): void {
    console.log("component");
    console.log(this.evolutionData);
    this.displayDate = new Date();
    this.initMap();
    this.addInfoBox(this.formatDate(this.displayDate));
    this.addLegend();
    this.shapeService.getCountriesShapes().subscribe((country) => {
      country.features.forEach((item) => {
        const foundCountry = this.countries.find(
          (country) => country.alpha3 === item.id
        );
        if (foundCountry) {
          // we add data from apit to each country
          item.countryData = foundCountry;
        } else {
          item.countryData = null;
        }
      });
      this.initStatesLayer(country);
    });

    // we populate the maps with markers
    // this.markerService.makeStateMarkers(this.map);
    // this.markerService.makeStateCircleMarkers(this.map);
  }

  ngAfterViewInit(): void {}

  private initMap(): void {
    // we create the map
    this.map = L.map("map", {
      center: [40.416775, -3.70379],
      zoom: 2,
    });
    // we add tiles for our map
    this.mapTiles.addTiles(this.map);
  }

  private addInfoBox(displayDate) {
    // we add info box
    this.info = L.control();

    this.info.onAdd = function (map) {
      this._div = L.DomUtil.create("div", "info"); // create a div with a class "info"
      this.update();
      this._div.innerHTML =
        `<h4 class="date-label">Current Date :</h4>` +
        `<h1 class="display-date">${displayDate}</h1>`;
      return this._div;
    };

    // const getTextColor = function (status: string, coverage: string) {
    //   if (status) {
    //     if (status == "Closed" && coverage == "General") {
    //       return colors["Nationwide closure"];
    //     }
    //     if (status == "Closed" && coverage == "Partial") {
    //       return colors["Partial closure"];
    //     }
    //     if (status == "Re-opening") {
    //       return "#ddcb30"; // we return a "Darker yellow"(the "lighter yellow" with white background looks wierd)
    //     }
    //     return colors[status];
    //   }
    // };

    // method that we will use to update the control based on feature properties passed
    this.info.update = function (displayDate) {
      this._div.innerHTML =
        `<h4 class="date-label">Current Date :</h4>` +
        `<h1 class="display-date">${displayDate}</h1>`;
    };

    this.info.addTo(this.map);
  }

  private addLegend() {
    // we add legends to our map
    this.legend = L.control({ position: "bottomleft" });
    this.legend.onAdd = function (map) {
      const div = L.DomUtil.create("div", "info legend");
      const status = ["No Data", "0", "1", "2", "3", "default"];
      const labels = [
        "No Data",
        "No closure",
        "Closure recommended",
        "Closure(some levels)",
        "Closure(all levels)",
        "default",
      ];

      // loop through our density intervals and generate a label with a colored square for each interval
      for (let i = 0; i < status.length; i++) {
        div.innerHTML +=
          '<i style="background:' +
          colors[status[i]] +
          '"></i>    <strong>' +
          labels[i] +
          "</strong> <br>";
      }

      return div;
    };

    this.legend.addTo(this.map);
  }

  private initStatesLayer(item) {
    const stateLayer = L.geoJSON(item, {
      style: (feature) => ({
        weight: 3,
        opacity: 0.5,
        color: "aliceblue",
        fillOpacity: 0.8,
        fillColor: this.getFillColor(feature.countryData),
      }),
      // onEachFeature: (feature, layer) =>
      //   layer.bindPopup(this.clickedCountry(feature.countryData)).on({
      //     mouseover: (e) => this.highlightFeature(e),
      //     mouseout: (e) => this.resetFeature(e),
      //   }),
    });
    this.map.addLayer(stateLayer);
  }

  private getFillColor(country: Country) {
    console.log(country);
    if (country) {
      let status = country.status;
      if (status === "Closed") {
        status =
          country.current_coverage === "General"
            ? "Nationwide closure"
            : "Partial closure";
      }
      return colors[status];
    }
    return colors["No data"];
  }

  private highlightFeature(e) {
    const layer = e.target;
    layer.setStyle({
      weight: 2,
      opacity: 1,
      fillOpacity: 0.6,
    });
    this.info.update(layer.feature.countryData);
  }

  private resetFeature(e) {
    const layer = e.target;
    layer.setStyle({
      weight: 3,
      opacity: 0.5,
      color: "aliceblue",
      fillOpacity: 0.8,
    });
    this.info.update();
  }
  private clickedCountry(country) {
    if (country) {
      return `
        <div>
          <h6>
            <strong>${country.name}</strong>
          </h6>
          <div class="pb-2">
            <p class="p-0 m-0">
              <strong>Current coverage:</strong> ${country.current_coverage}
            </p>
            <p class="p-0 m-0">
              <strong>Start date:</strong> ${country.start}
            </p>
            <p class="p-0 m-0">
              <strong>Start softening date:</strong> ${country.start_reopening}
            </p>
            <p class="p-0 m-0">
              <strong>End date:</strong> ${country.end}
            </p>
          </div>
          <div class="d-flex justify-content-center">
            <a href="#/country/${country.alpha3}">
              <button class="mat-raised-button mat-button-base mat-primary text-light">More Details</button>
            </a>
          </div>
        </div>
      `;
    }
  }

  private increaseDate(theDate: Date, day: number = 1): void {
    theDate.setDate(theDate.getDate() + day);
    this.info.update(this.formatDate(this.displayDate));
  }

  private decreaseDate(theDate: Date, day: number = 1): void {
    theDate.setDate(theDate.getDate() - day);
    this.info.update(this.formatDate(this.displayDate));
  }

  private formatDate(date: Date): string {
    const casesDate = date;
    const month = casesDate.getMonth() + 1;
    const formattedDate = `${casesDate.getFullYear()}/${
      month < 10 ? "0" + month : month
    }/${casesDate.getDate()}`;
    return formattedDate;
  }
}

// “No data”: “#E3E3E3
// ",
// 0 = “No closure”: “#28A745
// ",
// 1 =“Closure recommended”: “#17A2B8
// ",
// 2 = “Closure(some levels) “: “#EE7F08
// ”,
// 3 = “Closure(all levels) “: “#E6595A
// ”,
// “default ”: “#555” (edited)
