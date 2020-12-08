import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export class Website {
    name: string
    url: string
    description: string
    owner: string

    constructor(name: string, url: string, desc: string, owner: string) {
        this.name = name
        this.url = url
        this.description = desc
        this.owner = owner
    }

    toJson() {
        return  {name: this.name, url: this.url, description: this.description, owner: this.owner}
    }
}


@Injectable({
    providedIn: 'root'
})
export class WebsiteService {

    constructor(private http: HttpClient, private authService: AuthService) { }

    add(web: Website) {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.post(environment.apiUrl + '/web/' + web.name , web.toJson(), httpOptions)
    }

    list(): Observable<Website[]> {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };

        return this.http.get(environment.apiUrl + '/web', httpOptions)
            .pipe(map((response: any) => {
                return response.map(item => {
                    return new Website(
                        item.name,
                        item.url,
                        item.description,
                        item.owner
                    );
                });
            }));
    }


    listOwner(id: string): Observable<Website[]> {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };

        return this.http.get(environment.apiUrl + '/web/owner/' + id, httpOptions)
            .pipe(map((response: any) => {
                return response.map(item => {
                    return new Website(
                        item.name,
                        item.url,
                        item.description,
                        item.owner
                    );
                });
            }));
    }

    remove(web: Website) {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.delete(environment.apiUrl + '/web/' + web.name , httpOptions)

    }

    changeOwner(siteName, siteOldOwner, siteNewOwner) {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };

        return this.http.put(environment.apiUrl + '/web/' + siteName + '/owner/' + siteOldOwner + '/' + siteNewOwner, {}, httpOptions)
    }
}
