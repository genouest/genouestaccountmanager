import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { User, UserService } from 'src/app/user/user.service';
import { AuthService } from '../../auth/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export class Group {
    gid: string;
    name: string;
    owner: string;
    description: string;
    tags: string[];
    new: boolean;

    constructor(
        gid: string = '', name: string = '', owner: string = '',
        description: string = '', tags: string[] = null, is_new: boolean = false
    ) {
        this.gid = gid; this.name = name; this.owner = owner;
        this.description = description; this.tags = tags; this.new = is_new;
    }
}

@Injectable({
    providedIn: 'root'
})
export class GroupsService {

    constructor(
        private http: HttpClient,
        private authService: AuthService,
        private userService: UserService
    ) {}

    mapToGroup(resp: any): Group {
        return new Group(
            resp.gid || '', resp.name || '', resp.owner || '',
            resp.description || '', resp.tags || null, resp.new || false
        );
    }


    list(): Observable<Group[]> {
        // let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };

        return this.http.get(
            environment.apiUrl + '/group',
            httpOptions
        ).pipe(map((response: any[]) => {
            response.sort(function (a,b) {
                return a.name.localeCompare(b.name);
            });
            return response.map(item => {
                return this.mapToGroup(item);
            });
        }));
    }

    getUsers(group_name: string): Observable<User[]> {
        // let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.get(
            environment.apiUrl + '/group/' + group_name + '/users',
            httpOptions
        ).pipe(map((response: any[]) => {
            return response.map(item => {
                return this.userService.mapToUser(item);
            });
        }));
    }

    get(group_name: string): Observable<Group> {
        // let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http
            .get(environment.apiUrl + '/group/' + group_name, httpOptions)
            .pipe(
                map((response) => {
                    return this.mapToGroup(response);
                })
            );
    }

    update(group: Group) {
        // let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.put(
            environment.apiUrl + '/group/' + group.name,
            group,
            httpOptions
        );
    }

    delete(groupId: string) {
        // let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.delete(
            environment.apiUrl + '/group/' + groupId,
            httpOptions
        );
    }

    add(group: Group) {
        // let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.post(
            environment.apiUrl + '/group/' + group.name,
            group,
            httpOptions
        );
    }

}
