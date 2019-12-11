import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../auth/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class GroupsService {

    constructor(private http: HttpClient, private authService: AuthService) { }


    list(): Observable<any[]> {
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
            return response.sort(function (a,b) {
                return a.name.localeCompare(b.name);
            });
        }));
    }

    get(groupId): Observable<any> {
        // let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.get(
            environment.apiUrl + '/group/' + groupId,
            httpOptions
        );
    }

    update(group) {
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

    delete(groupId) {
        // let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.delete(
            environment.apiUrl + '/group/' + groupId,
            httpOptions
        );  }

    add(group) {
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
