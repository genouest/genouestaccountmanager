import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  constructor(private authService: AuthService) { }

  userId: string
  password: string
  mail_token: string
  double_auth: boolean
  msg: string
  msgstatus: number

  ngOnInit() {
    this.double_auth = false;
    this.userId = '';
  }

  login() {
    this.authService.login(this.userId,this.password).then().catch( err => {this.msg = err.error;});
    this.password = "";
  }

  password_reset_request() {
    this.msgstatus = 0;
    this.msg = "";
    if(this.userId == null || this.userId == "") {
      this.msgstatus = 1;
      this.msg = "Please enter your used id!";
    }
    else {
      this.authService.passwordResetRequest(this.userId).subscribe(
        resp => this.msg = resp['message'],
        err => {
          console.log('failed to reset password', err);
          this.msg = err.error;
        }
      )
    }
  }

}
