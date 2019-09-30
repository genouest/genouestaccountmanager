/*
 * Code adapted from https://github.com/moff/angular2-flash-messages
 * License MIT
 * Author: Paul Moff
 */
import { Component, OnInit, Injectable, ChangeDetectorRef } from '@angular/core';


@Injectable({
    providedIn: 'root'
})
export class FlashMessagesService {
    show: (text?: string, options?: Object) => void;
    grayOut: (value: boolean) => void;
}

@Component({
    selector: 'flash-messages',
    templateUrl: './flash.component.html',
    styleUrls: ['./flash.component.css']
})
export class FlashComponent implements OnInit {

    private _defaults = {
        text: 'default message',
        closeOnClick: false,
        showCloseBtn: false,
        cssClass: ''
    };

    text: string;
    messages: FlashMessage[] = [];
    classes: string = '';
    _grayOut: boolean = false;

    constructor(private _flashMessagesService: FlashMessagesService, private _cdRef: ChangeDetectorRef) {
        this._flashMessagesService.show = this.show.bind(this);
        this._flashMessagesService.grayOut = this.grayOut.bind(this);
    }

    ngOnInit() {}

    show(text?: string, options = {}): void {

        let defaults = {
            timeout: 2500,
            closeOnClick: false,
            showCloseBtn: false,
            cssClass: '',
            text: "default message"
        };

        for (var attrname in options) { (<any>defaults)[attrname] = (<any>options)[attrname]; }

        let message = new FlashMessage(text, defaults.cssClass, defaults.closeOnClick, defaults.showCloseBtn);

        message.timer = window.setTimeout(() => {
            this._remove(message);
            this._cdRef.detectChanges();
        }, defaults.timeout);

        this.messages.push(message);
        this._cdRef.detectChanges();
    }

    close(message:FlashMessage): void {
        clearTimeout(message.timer);
        this._remove(message);
        this._cdRef.detectChanges();
    }

    alertClicked(message:FlashMessage): void {
        if(message.closeOnClick){
            this.close(message);
        }
    }

    grayOut(value = false) {
        this._grayOut = value;
    }

    private _remove(message: FlashMessage) {
        this.messages = this.messages.filter((msg) => msg.id !== message.id);
    }

}


export class FlashMessage {
    static nextId = 0;

    id: number = (FlashMessage.nextId++);
    text: string = 'default text';
    cssClass: string = '';
    closeOnClick: boolean = false;
    showCloseBtn: boolean = false;
    timer: number;

    constructor(text?: string, cssClass?: string, closeOnClick?: boolean, showCloseBtn?: boolean) {
        if (text) this.text = text;
        if (cssClass) this.cssClass = cssClass;
        if (closeOnClick) this.closeOnClick = closeOnClick;
        if (showCloseBtn) this.showCloseBtn = showCloseBtn;
    }
}
