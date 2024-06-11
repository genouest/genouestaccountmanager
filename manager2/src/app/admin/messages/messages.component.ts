import { Component, OnInit, ViewChild } from '@angular/core';
import { ConfigService } from 'src/app/config.service';
import { UserService } from 'src/app/user/user.service';

import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../auth/auth.service';

import { Observable } from 'rxjs';

import marked from 'marked';
import { Router } from '@angular/router';
import { FlashMessagesService } from 'src/app/utils/flash/flash.component';
import { Table } from 'primeng/table';

@Component({
    selector: 'app-messages',
    templateUrl: './messages.component.html',
    styleUrls: ['./messages.component.css']
})
export class MessagesComponent implements OnInit {
    @ViewChild('dtp') table: Table;

    origin: string

    msg: string
    error_msg: string

    mailing_lists: any
    mailing_list: any

    members: any

    message: string
    subject: string
    input_choices: string[] = ["HTML", "Text", "Markdown"]
    input_type: string = "HTML"


    constructor(
        private configService: ConfigService,
        private userService: UserService,
        private http: HttpClient,
        private authService: AuthService,
        private router: Router,
        private _flashMessagesService: FlashMessagesService
    ) { }

    ngOnInit() {
        this.mailing_list = '';
        this.mailing_lists = [];

        this.configService.config.subscribe(
            resp => this.origin = resp['origin'],
            err => console.log('failed to get config', err)
        )
        this.getMailingLists().subscribe(
            resp => {
                let lists = [];
                for(let i=0;i<resp.length;i++){
                    lists.push(resp[i])
                }
                this.mailing_lists = lists;
                /*if(lists.length > 0) {
                  this.mailing_list = lists[0];
                  }*/
            },
            err => console.log('failed to get mailing lists', err)
        )
    }

    ngAfterViewInit(): void {
    }

    ngOnDestroy(): void {
    }


    sendMessage(message, subject, mailing_list, input_type, origin): Observable<any> {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //})
        };
        let data = {
            message: message,
            subject: subject,
            list: mailing_list,
            input: input_type,
            from: origin
        }
        return this.http.post(
            environment.apiUrl + '/message',
            data,
            httpOptions
        );
    }

    getListMembers(list_name): Observable<any> {
        // let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //})
        };
        return this.http.get(
            environment.apiUrl + '/list/' + list_name,
            httpOptions
        );
    }

    getMailingLists(): Observable<any> {
        // let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //})
        };
        return this.http.get(
            environment.apiUrl + '/lists',
            httpOptions
        );
    }

    send() {
        this.msg = '';
        this.error_msg = '';
        if(this.message === '' || this.subject === '' || this.mailing_list === ''){
            this.error_msg = "You need a subject, text, and mailing list";
            return;
        }
        this.sendMessage(this.message, this.subject, this.mailing_list, this.input_type, this.origin).subscribe(
            resp => {
                this.msg = "Message sent";
                this._flashMessagesService.show('Message sent', { cssClass: 'alert-success', timeout: 5000 });
                this.router.navigate(['/user', this.authService.profile.uid]);
            },
            err => {
                this.error_msg = err.error.message
            }
        )
    }

    generate_list_members(event) {
        let list_name = this.mailing_list;
        this.getListMembers(list_name).subscribe(
            resp => {
                this.members = resp;
            },
            err => console.log('failed to get members')
        )
    };

    trustAsHtml(message): string {
        return message;
    };

    trustAsMarkdown(message): string {
        let mark = marked(message);
        return mark;
    };

    decode_template(event) {
        let list_name = this.mailing_list;
        this.message = '';
        let lists = this.mailing_lists;
        let template = '';
        let footer = '';
        let header = '';
        for(var i = 0; i < lists.length; i++){
            //if is a list with a name
            if (lists[i].list_name==list_name){
                if (this.input_type=="HTML"){
                    // Case template
                    if('template_html' in lists[i].config){
                        template = lists[i].config.template_html;
                        this.message = atob(template);
                        return;
                    };
                    if (lists[i].config.header_html) {
                        header = atob(lists[i].config.header_html);
                        header += "\n";
                    };
                    if (lists[i].config.footer_html) {
                        footer = atob(lists[i].config.footer_html);
                    };
                    this.message = header+footer;
                    return;
                } else if (this.input_type=="Markdown"){
                    if('template_markdown' in lists[i].config){
                        template = lists[i].config.template_markdown;
                        this.message = atob(template);
                        return;
                    };
                    if (lists[i].config.header_markdown){
                        header = atob(lists[i].config.header_markdown);
                        header += "\n";
                    };
                    if (lists[i].config.footer_markdown){
                        footer = atob(lists[i].config.footer_markdown);
                    };
                    this.message = header+footer;
                    return;
                } else if (this.input_type=="Text") {
                    if('template_text' in lists[i].config){
                        template = lists[i].config.template_text;
                        this.message = atob(template);
                        return;
                    };
                    if (lists[i].config.header_text) {
                        header = atob(lists[i].config.header_text);
                        header += "\n";
                    };
                    if (lists[i].config.footer_text) {
                        footer = atob(lists[i].config.footer_text);
                    };
                    this.message = header+footer;
                    return;
                };
            };
        }
    }

}
