import { Component, EventEmitter, Input, OnInit, Output, SimpleChanges } from '@angular/core';
import * as countryData from './country.json'; 

@Component({
  selector: 'app-country',
  templateUrl: './country.component.html',
  styleUrls: ['./country.component.css']
})
export class CountryComponent implements OnInit {
  @Input() preselectionnedCountry: string | null = null
  @Output() countrySelected = new EventEmitter<string>()
  country: string = ''
  countries: { name: string }[] = []

  ngOnInit(): void {
    this.countries = countryData["default"]
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['preselectionnedCountry'] && changes['preselectionnedCountry'].currentValue) {
      this.country = this.preselectionnedCountry!;
    }
  }

  onSelectCountry(value: string) {
    this.country = value
    this.countrySelected.emit(this.country)
  }
}