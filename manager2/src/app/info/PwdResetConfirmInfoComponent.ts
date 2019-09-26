import { Component, OnInit } from '@angular/core';
@Component({
    selector: 'app-info',
    templateUrl: './info.component.html',
    styleUrls: ['./info.component.css']
})
export class PwdResetConfirmInfoComponent implements OnInit {
    msg: string;
    constructor() {
        this.msg = "Your password has been reset, an email with your new password will be sent soon.";
    }
    ngOnInit() {
    }
}
