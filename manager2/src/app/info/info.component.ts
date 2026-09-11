import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-info',
    templateUrl: './info.component.html',
    styleUrls: ['./info.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class InfoComponent implements OnInit {
    msg: string;

    constructor() {}

    ngOnInit() {}
}
