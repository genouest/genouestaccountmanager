import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-pending-account',
    templateUrl: './pending-account.component.html',
    styleUrls: ['./pending-account.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PendingAccountComponent implements OnInit {
    constructor() {}

    ngOnInit() {}
}
