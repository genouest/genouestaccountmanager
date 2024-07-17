import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export class User {
    uid: string
    id: number
    firstname: string
    lastname: string
    email: string
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
    send_copy_to_support: boolean
    create_imap_mailbox: boolean
    created_at: number | null
    expiration: number
    duration: any
    registration: number
    group: string
    secondarygroups: string[]
    newgroup: string
    projects: string[] | null
    newproject: any
    tags: any
    regkey: number
    apikey: number
    ssh: string
    u2f: any
    otp: any
    history: any[]
    extra_info: any[]
    status: string
    temp: any

    constructor(
        uid: string = '', id: number = 0, first_name: string = '', last_name: string = '',
        email: string = '', lab: string = '', responsible: string = '', address: string = '',
        team: string = '', why: string = '', ip: string = '',
        is_admin: boolean = false, is_fake: boolean = false, is_locked: boolean = false, is_trainer: boolean = false,
        send_copy_to_support: boolean = false, create_imap_mailbox: boolean = false,
        created_at: number | null = null, expiration: number = 0, duration: any = null, registration: number = 0,
        group: string = '', secondary_groups: string[] = [], new_group: string = '',
        projects: string[] | null = null, new_project: any = null, tags: any = null,
        reg_key: number = 0, api_key: number = 0, ssh: string = '', u2f: any = null, otp: any = null,
        history: any[] = [], extra_info: any[] = [], status: string = '', temp: any = null
    ) {
        this.uid = uid; this.id = id; this.firstname = first_name; this.lastname = last_name;
        this.email = email; this.lab = lab; this.responsible = responsible; this.address = address;
        this.team = team; this.why = why; this.ip = ip;
        this.is_admin = is_admin; this.is_fake = is_fake; this.is_locked = is_locked; this.is_trainer = is_trainer;
        this.send_copy_to_support = send_copy_to_support; this.create_imap_mailbox = create_imap_mailbox;
        this.created_at = created_at; this.expiration = expiration; this.duration = duration; this.registration = registration;
        this.group = group; this.secondarygroups = secondary_groups; this.newgroup = new_group;
        this.projects = projects; this.newproject = new_project; this.tags = tags;
        this.regkey = reg_key; this.apikey = api_key; this.ssh = ssh; this.u2f = u2f; this.otp = otp;
        this.history = history; this.extra_info = extra_info; this.status = status; this.temp = temp;
    }
}

@Injectable({
    providedIn: 'root'
})
export class UserService {

    config: any

    constructor(private http: HttpClient, private authService: AuthService) {
    }

    mapToUser(resp: any): User {
        return new User(
            resp.uid || '', resp.id || 0, resp.firstname || '', resp.lastname || '',
            resp.email || '', resp. lab || '', resp.responsible || '', resp.address || '',
            resp.team || '', resp.why || '', resp.ip || '',
            resp.is_admin || false, resp.is_fake || false, resp.is_locked || false, resp.is_trainer || false,
            resp.send_copy_to_support || false, resp.create_imap_mailbox || false,
            resp.created_at || null, new Date(resp.expiration).getTime() || 0,
            resp.duration || null, new Date(resp.registration).getTime() || 0,
            resp.group || '', resp.secondarygroups || [], resp.newgroup || '',
            resp.projects || null, resp.newproject || null, resp.tags || null,
            resp.regkey || 0, resp.apikey || 0, resp.ssh || '', resp.u2f || null, resp.otp || null,
            resp.history || [], resp.extra_info || [], resp.status || '', resp.temp || null
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
        ).pipe(map(response => {
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

    getUser(id: string): Observable<User> {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.get(
            environment.apiUrl + '/user/' + id,
            httpOptions
        ).pipe(map(response => {
            return this.mapToUser(response);
        }));
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
            return response.map(item => {
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

    register(userId: string, user: User) {
        //let user = this.authService.profile;
        let httpOptions = {
        };
        return this.http.post(
            environment.apiUrl + '/user/' + userId,
            user,
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
