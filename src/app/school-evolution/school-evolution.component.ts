import { Component, OnInit, ChangeDetectorRef } from "@angular/core";
import { Title } from "@angular/platform-browser";
import { HttpClient } from "@angular/common/http";
import { aws, mobileWidth } from "../utils";

@Component({
  selector: "app-school-evolution",
  templateUrl: "./school-evolution.component.html",
  styleUrls: ["./school-evolution.component.css"],
})
export class SchoolEvolutionComponent implements OnInit {
  public schoolClosureData: any;
  public schoolClosureTableUpdatedOn: string;
  public isMobile: boolean;
  public evolutionData: any;
  constructor(
    private titleService: Title,
    private http: HttpClient,
    private changeDetector: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.titleService.setTitle(
      "School Closure: Citizens Tracking School Closures"
    );
    this.isMobile = window.innerWidth > mobileWidth ? false : true;

    this.schoolClosureData = await this.http
      .get(`${aws}/school_closure.json`)
      .toPromise();
    this.evolutionData = await this.http
      .get(`${aws}/evolution.json`)
      .toPromise();
    this.schoolClosureTableUpdatedOn = this.schoolClosureData.updatedOn;
    this.changeDetector.detectChanges();
  }
}
