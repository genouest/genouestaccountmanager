import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class UserService {

    config: any

    constructor(private http: HttpClient, private authService: AuthService) {
    }

    getUserLogs(userId: string) {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //})
        };
        return this.http.get(
            environment.apiUrl + '/log/user/' + userId,
            httpOptions
        );

    }

    getUsages() {
        let user = this.authService.profile;

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //})
        };
        return this.http.get(
            environment.apiUrl + '/user/' + user.uid + '/usage',
            httpOptions
        );

    }

    u2fGet(userId: string) {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.get(
            environment.apiUrl + '/u2f/register/' + userId,
            httpOptions)
    }

    u2fSet(userId: string, data: any) {
        let httpOptions = {
            // headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.post(
            environment.apiUrl + '/u2f/register/' + userId,
            data,
            httpOptions)
    }

    otpRegister(userId: string) {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.post(
            environment.apiUrl + '/otp/register/' + userId,
            {},
            httpOptions)       
    }

    delete(userId: string, message: string, sendmail: boolean) {
        // console.log(userId, message);
        let httpOptions = {
            headers: new HttpHeaders({
                'Content-Type': 'application/json'
                //  'x-api-key': localStorage.getItem('my-api-key')
            }),
            body: {
                message: message,
                sendmail: sendmail

            },
        };
        return this.http.delete(
            environment.apiUrl + '/user/' + userId,
            httpOptions)
    }

    updateSSH(userId: string, ssh: string) {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.put(
            environment.apiUrl + '/user/' + userId + '/ssh',
            {ssh: ssh},
            httpOptions)
    }

    update(userId: string, user) {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.put(
            environment.apiUrl + '/user/' + userId ,
            user,
            httpOptions)
    }

    activate(userId: string) {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.get(
            environment.apiUrl + '/user/' + userId + '/activate',
            httpOptions)
    }

    expire(userId) {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.get(
            environment.apiUrl + '/user/' + userId + '/expire',
            httpOptions)
    }

    renew(userId) {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.get(
            environment.apiUrl + '/user/' + userId + '/renew',
            httpOptions)
    }

    addToProject(owner: string, projectId: string) {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.post(
            environment.apiUrl + '/user/' + owner + '/project/' + projectId,
            {},
            httpOptions)
    }

    addGroup(owner: string, groupName: string) {
        let httpOptions = {
            //headers: new HttpHeaders({
            // 'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.post(
            environment.apiUrl + '/user/' + owner + '/group/' + groupName,
            {},
            httpOptions)
    }

    deleteGroup(owner: string, groupName: string) {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.delete(
            environment.apiUrl + '/user/' + owner + '/group/' + groupName,
            httpOptions)
    }

    getSSHKey(owner: string, key: string): Observable<string>{
        return this.http.get(
            environment.apiUrl + '/ssh/' + owner + '/' + key,
            {responseType: 'text'})
    }

    getNewSSHKey(id: string) {
        let httpOptions = {
        };
        return this.http.get(
            environment.apiUrl + '/ssh/' + id,
            httpOptions)
    }

    generateApiKey(id: string) {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.post(
            environment.apiUrl + '/user/' + id + '/apikey',
            {},
            httpOptions)
    }

    notify(id: string, options: any) {

        let httpOptions = {};
        return this.http.post(
            environment.apiUrl + '/user/' + id + '/notify',
            options,
            httpOptions)
    }

    updatePassword(id: string, password: string) {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.post(
            environment.apiUrl + '/user/' + id + '/passwordreset/',
            {'password': password},
            httpOptions)
    }

    isSubscribed(id: string) {
        //let user = this.authService.profile;
        let httpOptions = {
            // headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.get(
            environment.apiUrl + '/user/' + id + '/subscribed',
            httpOptions)
    }

    subscribe(id: string) {
        let httpOptions = {
        };
        return this.http.put(
            environment.apiUrl + '/user/' + id + '/subscribe/',
            {},
            httpOptions)
    }

    unsubscribe(id: string) {
        let httpOptions = {
        };
        return this.http.put(
            environment.apiUrl + '/user/' + id + '/unsubscribe/',
            {},
            httpOptions)
    }

    getUser(id: string) {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.get(
            environment.apiUrl + '/user/' + id,
            httpOptions)
    }

    list() {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.get(
            environment.apiUrl + '/user',
            httpOptions).pipe(map((response: any[]) => {
                return response.sort(function (a,b) {
                    return a.uid.localeCompare(b.uid);
                });
            }));
    }

    removeFromProject(userId: string, projectId: string) {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.delete(
            environment.apiUrl + '/user/' + userId + '/project/' + projectId,
            httpOptions)
    }

    register(userId: string, userInfo) {
        //let user = this.authService.profile;
        let httpOptions = {
        };
        return this.http.post(
            environment.apiUrl + '/user/' + userId,
            userInfo,
            httpOptions)
    }

    extend(userId, regKey) {
        //console.log(environment.apiUrl + '/user/' + userId + '/renew/' + regKey)
        let httpOptions = {
            headers: new HttpHeaders({
                'Accept': 'application/json'
            })
        }
        return this.http.get(
            environment.apiUrl + '/user/' + userId + '/renew/' + regKey, httpOptions
        )
    }

    add_note(userId, note) {
        //console.log(environment.apiUrl + '/user/' + userId + '/renew/' + regKey)
        let httpOptions = {
            headers: new HttpHeaders({
                'Accept': 'application/json'
            })
        }
        return this.http.post(
            environment.apiUrl + '/log/user/' + userId,
            {'log': note},
            httpOptions
        )
    }
}
