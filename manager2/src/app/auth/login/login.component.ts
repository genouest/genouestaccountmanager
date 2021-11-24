import { Component, OnInit, NgZone } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { FlashMessagesService } from 'src/app/utils/flash/flash.component';
import { solveLoginChallenge } from '@webauthn/client';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

    constructor(
        private authService: AuthService,
        private router: Router,
        private ngZone: NgZone,
        private _flashMessagesService: FlashMessagesService
    ) { }

    static SUCCESS: number = 0;
    static ERROR: number = 1;

    userId: string
    password: string
    mail_token: string
    otp_token: string
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

    manageOTP() {
        let ctx = this;
        this.authService.otpCheck(this.userId, this.otp_token).subscribe(
            resp => {
                ctx.authService.handleLoginCallback(this.userData);
                ctx.authService.authenticated = true;
                ctx.authService.$authStatus.next(true);
                this.ngZone.run(() => { ctx.router.navigate(['/user/' + this.userData['uid']]); });
            },
            err => {
                console.error('otp challenge error', err);
                ctx.msg = 'Failed to authenticate with OTP';
                ctx.msgstatus = LoginComponent.ERROR;
            }
        )
    }

    _manageU2F(userData: any) {
        this.authService.u2f(userData['uid']).subscribe(
            resp => {
                console.log('u2f', resp);
                let challenge = resp;
                let ctx = this;
                solveLoginChallenge(challenge).then(credentials => {

                    ctx.authService.u2fCheck(userData['uid'], credentials).subscribe(
                        resp => {
                            if(resp['token']) {
                                userData['token'] = resp['token'];
                            }
                            console.log('auth with u2f success');
                            ctx.authService.handleLoginCallback(userData);
                            ctx.authService.authenticated = true;
                            ctx.authService.$authStatus.next(true);

                            this.ngZone.run(() => { ctx.router.navigate(['/user/' + userData['uid']]); });
                        }, err =>{
                            console.log('Failed to validate token with device');
                            ctx.msg = 'Failed to authenticate with device';
                            ctx.msgstatus = LoginComponent.ERROR;
                            return 
                        }
                    );

                    
                }).catch(err => {
                    console.error('webauthn challenge error', err);
                    ctx.msg = 'Failed to authenticate with device';
                    ctx.msgstatus = LoginComponent.ERROR
                    return;
                });
            },
            err => console.log('failed to get u2f info')
        )
    }

    _check_userId() {
        this.msgstatus = 0;
        this.msg = "";
        if(this.userId == null || this.userId == "") {
            this.msgstatus = 1;
            this.msg = "Please enter your user id!";
            return false;
        }
        if (this.userId.match(/[^0-9a-z]/gi))
        {
            this.msgstatus = 1;
            this.msg = "Please enter a valid user id!";
            return false;
        }
        return true;
    }

    login() {
        if (this._check_userId()) {
            this.authService.login(this.userId,this.password).then(
                userData => {
                    if(userData['double_auth']) {
                        this.userData = userData;
                        console.log('double authentication needed');
                        this.double_auth = true;
                        
                        this._manageU2F(userData);
                    } else {
                        this.router.navigate(['/']); // as home will redirect us in the right page
                    }
                }
            ).catch( err => {this.msg = err.error.message;});
        }
        this.password = "";
    }

    password_reset_request() {
        if (this._check_userId()) {
            this.authService.passwordResetRequest(this.userId).subscribe(
                resp => this.msg = resp['message'],
                err => {
                    console.log('failed to reset password', err);
                    this.msg = err.error.message;
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
        if(!this.mail_token) {
            this.error_msg = 'Token is empty';
            return;
        }
        let data = {'token': this.mail_token.trim()};
        this.authService.checkEmailToken(this.userId, data).then().catch(err => {
            this.msg = '';
            this.error_msg = 'Failed to validate token';
            console.log('failed to validate token', err)
        });
    }

}
