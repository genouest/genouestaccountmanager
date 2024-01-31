import { Component, Input, OnInit } from '@angular/core';

@Component({
    selector: 'app-my-expire-confirm',
    templateUrl: './my-expire-confirm.component.html',
    styleUrls: ['./my-expire-confirm.component.css']
})
export class MyExpireConfirmComponent implements OnInit {

    isExpiring: boolean
    sendmail: boolean

    @Input()
    onConfirm: any

    @Input()
    mailer: string

    @Input()
    data: any

    constructor() { }

    ngOnInit() {
        this.sendmail =  true;
        console.log(this.mailer)
    }

    startExpire(){
        this.isExpiring = true;
    }
    cancel() {
        this.isExpiring = false;
        this.sendmail = true;
    }
    confirm() {
        this.onConfirm(this.sendmail);
    }
}
