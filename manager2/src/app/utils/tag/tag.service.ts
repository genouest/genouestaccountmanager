import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../auth/auth.service';
//import { Observable } from 'rxjs';
//import { map } from 'rxjs/operators';


@Injectable({
    providedIn: 'root'
})
export class TagService {

    constructor(private http: HttpClient, private authService: AuthService) { }

    set(tags: string[], kind: string, id: string) {
        return this.http.post(environment.apiUrl + '/tags/' + kind + '/' + id , {'tags': tags}, {})
    }

    get() {
        return this.http.get(environment.apiUrl + '/tags', {});
    }
}
