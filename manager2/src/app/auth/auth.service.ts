import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { Observable, Subscription } from 'rxjs';
import { Subject } from "rxjs";
import { catchError,tap} from 'rxjs/operators';


@Injectable({
    providedIn: 'root'
})
export class AuthService {

    public $authStatus =new Subject<boolean>();

    accessToken: string;
    authenticated: boolean;
    userProfile:  any;

    constructor(private http: HttpClient, private router: Router) {
    }

    login(login, password) {
        return new Promise((resolve, reject) => {
            this.http.post(
                environment.apiUrl + '/auth/' + login,
                { password: password },
                { observe: 'response' }).subscribe(
                    resp => {
                        if(! resp.body['user']) {
                            reject({'error': resp.body['msg']});
                            return;
                        }
                        //if(resp.body['token']) {
                        //  resp.body['user']['token'] = resp.body['token'];
                        //}

                        if(resp.body['double_auth']) {
                            resp.body['user']['double_auth'] = resp.body['double_auth']
                        }
                        if(! resp.body['user']['double_auth']) {
                            this.handleLoginCallback(resp.body['user']);
                            this.authenticated = true;
                            this.$authStatus.next(true);
                            resolve(resp.body['user']);
                        } else {
                            //this.accessToken = resp.body['user']['token'];
                            this.handleLoginCallback(resp.body['user']);
                            resolve(resp.body['user']);
                        }

                    },
                    err => {
                        reject(err);
                    }
                )
        });
    }

    u2f(userId) {
        return this.http.get(environment.apiUrl + '/u2f/auth/' + userId)
    }

    u2fCheck(userId, u2fData) {
        return this.http.post(environment.apiUrl + '/u2f/auth/' + userId, u2fData)
    }

    checkEmailToken(userId, data) {
        return new Promise((resolve, reject) => {
            this.http.post(
                environment.apiUrl + '/mail/auth/' + userId,
                data,
                { observe: 'response' }).subscribe(
                    resp => {
                        if(! resp.body['user']) {
                            reject({'error': resp.body['msg']});
                            return;
                        }
                        if(resp.body['token']) {
                            resp.body['user']['token'] = resp.body['token'];
                        }

                        this.handleLoginCallback(resp.body['user']);
                        this.authenticated = true;
                        this.$authStatus.next(true);
                        resolve();
                        this.router.navigate(['/user/' + resp.body['user']['uid']]);
                    },
                    err => {
                        reject(err);
                    }
                )
        });
    }

    handleLoginCallback(authResult) {
        this.getUserInfo(authResult);
    }

    getUserInfo(profile) {
        // Get user profile
        if (profile) {
            this._setSession(profile);
        }
    }

    private _setSession(profile) {
        // Save authentication data and update login status subject
        this.userProfile = profile;
        localStorage.setItem('my-user', JSON.stringify(profile))
        /*
          if(profile.token !== '') {
          this.accessToken = profile.token;
          this.authenticated = true;
          this.$authStatus.next(true);
          localStorage.setItem('my-api-key', profile.token);
          }*/
    }

    logout() {
        this.accessToken = null;
        this.userProfile = null;
        this.authenticated = false;
        this.$authStatus.next(false);
        localStorage.removeItem('my-api-key');
        localStorage.removeItem('my-user')
    }

    updateApiKey(token) {
        this.userProfile.apikey = token;
        // localStorage.setItem('my-api-key', token);

    }

    autoLog() {
        let key = localStorage.getItem('my-api-key')
        if (!key) {
            return
        }
        let httpOptions = {
            headers: new HttpHeaders({
                'x-api-key': key
            }),
        };
        this.http.get(environment.apiUrl + '/auth', httpOptions).subscribe(
            resp =>{
                //if(resp['token']) {
                //  resp['user']['token'] = resp['token'];
                //}
                if(resp['user']) {
                    this._setSession(resp['user']);
                    this.authenticated = true;
                    this.$authStatus.next(true);
                }
            },
            err => {console.log('Error', err);}
        )

    }

    get profile(): any {
        if(! this.userProfile && localStorage.getItem('my-user')) {
            return JSON.parse(localStorage.getItem('my-user'))
        }
        return this.userProfile
    }

    get isLoggedIn(): boolean {
        if(!this.authenticated && localStorage.getItem('my-api-key')) {
            return true
        }
        return this.authenticated
    }

    passwordResetRequest(userId) {
        return this.http.get(environment.apiUrl + '/user/' + userId + '/passwordreset')
    }

    emailTokenRequest(userId) {
        return this.http.get(environment.apiUrl + '/mail/auth/' + userId)
    }
}


@Injectable()
export class AuthInterceptor implements HttpInterceptor {

    constructor(private auth: AuthService, private router: Router) {}

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        let authReq = req;
        if(! this.auth.accessToken && localStorage.getItem('my-api-key')) {
            this.auth.accessToken = localStorage.getItem('my-api-key');
        }
        if(this.auth.accessToken) {
            authReq = req.clone({
                setHeaders: { Authorization: 'bearer ' + this.auth.accessToken }
            });
        }
        return next.handle(authReq).pipe(
            tap(event => {
                if(event['body'] && event['body']['token']) {
                    this.auth.accessToken = event['body']['token'];
                    localStorage.setItem('my-api-key', event['body']['token']);

                }
            }, error => {
                if(error.status == 401) {
                    this.auth.logout();
                    this.router.navigate(['/login']);
                }
            })
        );

    }
}
