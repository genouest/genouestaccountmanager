import { Component, EventEmitter, Input, OnInit, Output, SimpleChanges } from '@angular/core';
import * as researchData from './research-organizations.json';

@Component({
  selector: 'app-tutelle',
  templateUrl: './tutelle.component.html',
  styleUrls: ['./tutelle.component.css']
})
export class TutelleComponent implements OnInit {
  @Input() preselectionnedTutelle: string | null = null
  @Output() tutelleSelected = new EventEmitter<string>()
  tutelleList: { category: String, name: string }[] = []
  tutelle: string = ''

  ngOnInit(): void {
    this.tutelleList = Object.entries(researchData["default"])
      .reduce((acc, [category, organizations]) => {
        if (Array.isArray(organizations)) {
          acc.push(...organizations.map((org: any) => ({
            category: category,
            name: org.name
          })));
        }
        return acc;
      }, [] as { category: string, name: string }[])
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['preselectionnedTutelle'] && changes['preselectionnedTutelle'].currentValue) {
      this.tutelle = this.preselectionnedTutelle!;
    }
  }

  onSelectTutelle(value: string) {
    this.tutelle = value
    this.tutelleSelected.emit(this.tutelle)
  }
}