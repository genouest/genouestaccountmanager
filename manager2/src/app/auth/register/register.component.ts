import { Component, OnInit } from '@angular/core';
import { UserService } from 'src/app/user/user.service';
import { ConfigService } from 'src/app/config.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit {

  msg: string
  msgstatus: number = 0

  uid: string
  duration: number = 365
  config: any = {}

  userid: string
  firstname: string
  lastname: string
  address: string
  lab: string
  responsible: string
  group: string
  email: string
  ip: string
  why: string

  agree: boolean

  constructor(
    private userService: UserService,
    private configService: ConfigService,
    private http: HttpClient,
    private router: Router
    ) { }

  ngOnInit() {
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
      this.userid = first.charAt(0).toLowerCase() + last.toLowerCase().replace(' ', '');
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
      group: this.group,
      email: this.email,
      ip: this.ip,
      duration: this.duration,
      why: this.why
    }).subscribe(
      resp => {
        this.msg = resp['msg'];
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
