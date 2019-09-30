import { Component, OnInit } from '@angular/core';

@Component({
    selector: 'app-info',
    templateUrl: './info.component.html',
    styleUrls: ['./info.component.css']
})
export class PendingApprovalInfoComponent implements OnInit {
    msg: string;
    constructor() {
        this.msg = "Your account is waiting for admin approval.";
    }
    ngOnInit() {
    }
}
