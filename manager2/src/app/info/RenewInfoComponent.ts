import { Component, OnInit } from '@angular/core';
@Component({
    selector: 'app-info',
    templateUrl: './info.component.html',
    styleUrls: ['./info.component.css']
})
export class RenewInfoComponent implements OnInit {
    msg: string;
    constructor() {
        this.msg = "Account validity period has been extended.";
    }
    ngOnInit() {
    }
}
