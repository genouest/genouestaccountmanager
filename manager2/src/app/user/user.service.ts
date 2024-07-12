import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export class User {
    uid: string
    id: number
    first_name: string
    last_name: string
    email: string
    send_copy_to_support: boolean
    create_imap_mailbox: boolean
    lab: string
    responsible: string
    address: string
    team: string
    why: string
    ip: string
    is_admin: boolean
    is_fake: boolean
    is_locked: boolean
    is_trainer: boolean
    duration: any
    history: any[]
    extra_info: any[]
    registration: number
    created_at: number | null
    group: string
    secondary_groups: string[]
    new_group: string
    projects: string[] | null
    new_project: any
    status: string
    expiration: number
    reg_key: number
    api_key: number
    ssh: string
    u2f: any
    otp: any
    temp: any

    constructor(first_name: string = '') {
        this.first_name = first_name;
    }
}

@Injectable({
    providedIn: 'root'
})
export class UserService {

    config: any

    constructor(private http: HttpClient, private authService: AuthService) {
    }

    private mapToUser(response: any): User {
        return new User(
            response.first_name || ''
        );
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

    otpRemove(userId: string) {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.delete(
            environment.apiUrl + '/otp/register/' + userId,
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

    updateSSH(userId: string, ssh: string): Observable<User> {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.put(
            environment.apiUrl + '/user/' + userId + '/ssh',
            {ssh: ssh},
            httpOptions
        ).pipe(map((response: any) => {
            return this.mapToUser(response);
        }));
    }

    update(userId: string, user: User): Observable<User> {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.put(
            environment.apiUrl + '/user/' + userId ,
            user,
            httpOptions
        ).pipe(map((response: any) => {
            return this.mapToUser(response);
        }));
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

    expire(userId: string, sendmail: boolean) {

        let params = new HttpParams()
        if (!sendmail) {
            params = params.append("sendmail", "false")
        }

        let httpOptions = {
            params: params
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };

        return this.http.get(
            environment.apiUrl + '/user/' + userId + '/expire',
            httpOptions)
    }

    renew(userId: string) {
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

    list(): Observable<User[]> {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.get(
            environment.apiUrl + '/user',
            httpOptions
        ).pipe(map((response: any[]) => {
            response.sort(function (a,b) {
                return a.uid.localeCompare(b.uid);
            });
            return response.map((item: any) => {
                return this.mapToUser(item);
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

    register(userId: string, userInfo: any) {
        //let user = this.authService.profile;
        let httpOptions = {
        };
        return this.http.post(
            environment.apiUrl + '/user/' + userId,
            userInfo,
            httpOptions)
    }

    extend(userId: string, regKey: number) {
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

    add_note(userId: string, note: string) {
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

    unlock(userId: string) {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.get(
            environment.apiUrl + '/user/' + userId + '/unlock',
            httpOptions)
    }
}
