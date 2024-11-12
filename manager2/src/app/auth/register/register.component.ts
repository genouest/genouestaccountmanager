import { Component, OnInit } from '@angular/core';
import { User, UserService } from 'src/app/user/user.service';
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

    uid: string
    duration: string = '1 year'
    config: any = {}

    user_id: string
    first_name: string
    last_name: string
    address: string
    zipCode: string
    city: string
    country: string
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

    session_user: User

    constructor(
        private authService: AuthService,
        private userService: UserService,
        private configService: ConfigService,
        private http: HttpClient,
        private router: Router
    ) { }

    ngOnInit() {
        this.session_user = this.authService.profile;
        this.onExtraValue = this.onExtraValue.bind(this);
        this.configService.config.subscribe(
            resp => {
                this.config = resp ;
                if (resp['max_account']) {
                    this.msg = "Warning: we reached our user maximum capacity, your request may be rejected or you may be on waiting list"
                }
            },
            err => console.log('failed to get config')
        );
        this.http.get('https://json.geoiplookup.io').subscribe(
            resp => this.ip = resp['ip'],
            err => this.ip = '127.0.0.1'
        );
        this.send_copy_to_support = false;
        this.create_imap_mailbox = false;
        this.is_fake = false;
    }

    onExtraValue(extras: any) {
        console.debug('extras updated', extras);
        let new_extra = [];
        for (let i = 0; i < extras.length; i++) {
            let extra = extras[i];
            new_extra.push({ 'title': extra.title, 'value': extra.value });
        }
        this.extra_info = new_extra;
    }

    update_user_id(event: string, origin: number) {
        let first = this.first_name;
        let last = this.last_name;
        if(origin == 0) {
            first = event;
        } else {
            last = event;
        }
        if (event === undefined || event === null || first === "" || last === "") {
            return;
        }
        if(this.first_name && this.last_name) {
            let tmp_user_id: string = latinize(first.charAt(0).toLowerCase() + last.toLowerCase().replace(' ', ''));
            // remove non alpha numeric char as they are not allowed in backend
            this.user_id = tmp_user_id.replace(/[^0-9a-z]/gi, '');
        }
    }

    register() {
        console.log("t laaaa", this.zipCode)
        this.msg = '';
        if(this.first_name == '' || this.first_name === null || this.first_name === undefined) {
            this.msg = 'Missing field: first name';
            return;
        }
        if(this.last_name == '' || this.last_name === null || this.last_name === undefined) {
            this.msg = 'Missing field: last name';
            return;
        }
        if(this.email == '' || this.email === null || this.email === undefined) {
            this.msg = 'Missing field: email';
            return;
        }
        if(this.lab == '' || this.lab === null || this.lab === undefined) {
            this.msg = 'Missing field: lab';
            return;
        }
        if(this.responsible == '' || this.responsible === null || this.responsible === undefined) {
            this.msg = 'Missing field: manager';
            return;
        }
        if(this.address == '' || this.address === null || this.address === undefined) {
            this.msg = 'Missing field: address';
            return;
        }
        if (!this.zipCode) {
            this.msg = 'Missing field: ZIP code';
            return;
        }
        if (!this.city) {
            this.msg = 'Missing field: city';
            return;
        }
        if (!this.country) {
            this.msg = 'Missing field: country';
            return;
        }
        if(this.team == '' || this.team === null || this.team === undefined) {
            this.msg = 'Missing field: team';
            return;
        }
        if(this.why == '' || this.why === null || this.why === undefined) {
            this.msg = 'Missing field: why do you need an account';
            return;
        }
        if(!this.agree) {
            this.msg="You must agree with the terms of use";
            return;
        }
        if(this.user_id  ===  undefined || this.user_id  ===  "") {
            this.msg="User identifier invalid (empty)";
            return;
        }
        if(this.user_id.length < 4) {
            this.msg="User identifier too short (min 4 characters)";
            return;
        }
        if (!this.first_name.match(/^[a-zA-Z]+$/) || !this.last_name.match(/^[a-zA-Z]+$/)) {
            this.msg = 'Name contains unauthorized characters';
            return;
        }
        if (!this.team.match(/^[0-9a-z_]+$/)) {
            this.msg = 'Team must be alphanumerical [0-9a-z_]';
            return;
        }
        const user: User = this.userService.mapToUser({
            firstname: this.first_name,
            lastname: this.last_name,
            address: this.address,
            lab: this.lab,
            zipCode: this.zipCode,
            city: this.city,
            country: this.country,
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
        });
        this.userService.register(this.user_id, user).subscribe(
            resp => {
                this.msg = resp['message'];
                if(resp['status'] == 0) {
                    this.router.navigate(['/registered']);
                    // to /registered
                }
            },
            err => console.log('failed to register')
        );
    }
}
