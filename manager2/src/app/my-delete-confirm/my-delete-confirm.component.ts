import { Component, Input, OnInit } from '@angular/core';

@Component({
    selector: 'app-my-delete-confirm',
    templateUrl: './my-delete-confirm.component.html',
    styleUrls: ['./my-delete-confirm.component.css']
})
export class MyDeleteConfirmComponent implements OnInit {

    isDeleting: boolean
    message: string
    sendmail: boolean

    @Input()
    onConfirm: any

    @Input()
    data: any

    @Input()
    explainMessage: boolean

    constructor() { }

    ngOnInit() {
        this.sendmail =  true;
    }

    startDelete(){
        this.isDeleting = true;
    }
    cancel() {
        this.isDeleting = false;
        this.message = "";
    }
    confirm() {
        if (this.explainMessage) {
            this.onConfirm(this.message, this.sendmail);
        } else {
            this.onConfirm(this.data);
        }
    }
}
