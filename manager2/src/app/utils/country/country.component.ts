import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import * as countryData from './country.json'; 

@Component({
  selector: 'app-country',
  templateUrl: './country.component.html',
  styleUrls: ['./country.component.css']
})
export class CountryComponent implements OnInit {
  @Input() preselectionnedValue: string | null = null
  @Output() countrySelected = new EventEmitter<string>()
  country: string = ''
  countries: { name: string }[] = []

  ngOnInit(): void {
    this.countries = countryData["default"]
    if (this.preselectionnedValue) {
      this.country = this.preselectionnedValue
    }
  }

  onSelectCountry(value: string) {
    this.country = value
    this.countrySelected.emit(this.country)
  }
}