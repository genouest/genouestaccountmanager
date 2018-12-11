import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  constructor(private authService: AuthService, private router: Router) { }

  static SUCCESS: number = 0;
  static ERROR: number = 1;

  userId: string
  password: string
  mail_token: string
  double_auth: boolean
  msg: string
  error_msg: string
  msgstatus: number

  u2f: any
  uid: string

  userData: any

  ngOnInit() {
    this.double_auth = false;
    this.userId = '';
  }

  _manageU2F(userData: any) {
    this.authService.u2f(userData['uid']).subscribe(
      resp => {
        console.log('u2f', resp);
        this.u2f = resp['authRequest'];
        setTimeout(function() {
          this.window.u2f.sign(this.u2f.appId, this.u2f.challenge, [this.u2f], authResponse => {
            if(authResponse.errorCode) {
              console.log('Failed to sign challenge with device');
              this.msg = 'Failed to authenticate with device';
              this.msgstatus = this.ERROR
              return
            }
            let data = {
              'authRequest': this.u2f,
              'authResponse': authResponse
            }
            this.authService.u2fCheck(userData['uid'], data).subscribe(
              resp => {
                if(resp['errorCode']) {
                  console.log('Failed to validate token with device');
                  this.msg = 'Failed to authenticate with device';
                  this.msgstatus = this.ERROR;
                  return                 
                }
                if(resp['token']) {
                  userData['token'] = resp['token'];
                }
                this.authService.handleLoginCallback(userData);
                this.authenticated = true;
                this.router.navigate(['/user/' + resp.body['user']['uid']]);
              },
              err => {
                console.log('Failed to validate token with device');
                this.msg = 'Failed to authenticate with device';
                this.msgstatus = this.ERROR;
              }
            )
          })
        }, 5000)
      },
      err => console.log('failed to get u2f info')
    )
  }

  login() {
    this.authService.login(this.userId,this.password).then(
      userData => {
        if(userData['double_auth']) {
          this.userData = userData;
          console.log('double authentication needed');
          this.double_auth = true;
          this._manageU2F(userData);
          //this.authService.handleLoginCallback(userData);
          //this.router.navigate(['/user/' + userData['uid']]);
        }
      }
    ).catch( err => {this.msg = err.error;});
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

  request_email_token(){
    this.authService.emailTokenRequest(this.userId).subscribe(
      resp => {
        this.error_msg = '';
        this.msg = 'Mail token request sent';
        if(resp['email_token']) {
          this.authService.accessToken = resp['email_token'];
        }
      },
      err => console.log('failed to request email token')
    )
  }

  validate_email_token() {
    let data = {'token': this.mail_token};
    this.authService.checkEmailToken(this.userId, data).then().catch(err => {
      this.msg = '';
      this.error_msg = 'Failed to validate token';
      console.log('failed to validate token', err)
    });
}

}
