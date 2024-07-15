import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { User, UserService } from 'src/app/user/user.service';
import { AuthService } from '../../auth/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export class Group {
    name: string
    owner: string
    description: string
    new: boolean

    constructor(name: string = '', owner: string = '', description: string = '', is_new: boolean = false) {
        this.name = name
        this.owner = owner
        this.description = description
        this.new = is_new
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
    ) { }


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
                return new Group(
                    item.name || '',
                    item.owner || '',
                    item.description || '',
                    false
                );
            });
        }));
    }

    get(groupId: string): Observable<User[]> {
        // let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.get(
            environment.apiUrl + '/group/' + groupId,
            httpOptions
        ).pipe(map((response: any[]) => {
            return response.map(item => {
                return this.userService.mapToUser(item);
            });
        }));
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
