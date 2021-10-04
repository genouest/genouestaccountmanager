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
    confirm(message: string) {
        if (message && !this.data) {
           this.data = message;
        }
        // console.log('app-my-delete-confirm', this.isDeleting, message, this.data);

        this.onConfirm(this.data);
    }

}
