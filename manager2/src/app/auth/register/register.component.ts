import { Component, OnInit } from '@angular/core';
import { UserService } from 'src/app/user/user.service';
import { ConfigService } from 'src/app/config.service';
import { AuthService } from 'src/app/auth/auth.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import * as latinize from 'latinize'

@Component({
    selector: 'app-register',
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit {
    //@ViewChild('extras') extras: UserExtraComponent
    msg: string
    msgstatus: number = 0

    uid: string
    duration: string = '1 year'
    config: any = {}

    userid: string
    firstname: string
    lastname: string
    address: string
    lab: string
    responsible: string
    team: string
    email: string
    ip: string
    why: string
    extra_info: any[]

    agree: boolean

    send_copy_to_support: boolean
    create_imap_mailbox: boolean
    is_fake: boolean

    session_user: any

    constructor(
        private authService: AuthService,
        private userService: UserService,
        private configService: ConfigService,
        private http: HttpClient,
        private router: Router
    ) { }

    ngOnInit() {
        this.session_user = this.authService.profile;
        this.onExtraValue = this.onExtraValue.bind(this)
        this.configService.config.subscribe(
            resp => {
                this.config = resp ;
                if (resp['max_account']) {
                    this.msg = "Warning: we reached our user maximum capacity, your request may be rejected or you may be on waiting list"
                }

            },
            err => console.log('failed to get config')
        )
        this.http.get('https://json.geoiplookup.io').subscribe(
            resp => this.ip = resp['ip'],
            err => this.ip = '127.0.0.1'
        )
        this.send_copy_to_support = false;
        this.create_imap_mailbox = false;
        this.is_fake = false;
    }

    onExtraValue(extras: any) {
        console.debug('extras updated', extras);
        let new_extra = [];
        for(let i=0;i<extras.length;i++){
            let extra = extras[i];
            new_extra.push({'title': extra.title, 'value': extra.value})
        }
        this.extra_info = new_extra;
    }

    update_userid(event, origin) {
        let first = this.firstname;
        let last = this.lastname;
        if(origin == 0) {
            first = event
        } else {
            last = event
        }
        if (event === undefined || event === null || first === "" || last === "") {
            return
        }
        if(this.firstname && this.lastname) {
            let tmpuserid = latinize(first.charAt(0).toLowerCase() + last.toLowerCase().replace(' ', ''));
            // remove non alpha numeric char as they are not allowed in backend
            this.userid = tmpuserid.replace(/[^0-9a-z]/gi,'');
        }
    }

    register() {
        this.msg = "";
        this.msgstatus = 0;
        if(! this.agree) {
            this.msg="You must agree with the terms of use";
            this.msgstatus = 1;
            return;
        }
        if(this.userid === undefined || this.userid === "") {
            this.msg="User identifier invalid (empty)"
            this.msgstatus = 1;
            return;
        }
        if(this.userid.length < 4) {
            this.msg="User identifier too short (min 4 characters)"
            this.msgstatus = 1;
            return;
        }
        this.userService.register(this.userid, {
            firstname: this.firstname,
            lastname: this.lastname,
            address: this.address,
            lab: this.lab,
            responsible: this.responsible,
            team: this.team,
            email: this.email,
            send_copy_to_support: this.send_copy_to_support,
            create_imap_mailbox: this.create_imap_mailbox,
            is_fake: this.is_fake,
            ip: this.ip,
            duration: this.duration,
            why: this.why,
            extra_info: this.extra_info
        }).subscribe(
            resp => {
                this.msg = resp['message'];
                this.msgstatus = resp['status'];
                if(resp['status'] == 0) {
                    this.router.navigate(['/registered']);
                    // to /registered
                }
            },
            err => console.log('failed to register')
        )


    }

}
