import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class TpserviceService {

    constructor(private http: HttpClient, private authService: AuthService) { }

    list(): Observable<any> {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };

        return this.http.get(environment.apiUrl + '/tp', httpOptions)
    }

    reserve(reservation): Observable<any> {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };

        return this.http.post(environment.apiUrl + '/tp', reservation, httpOptions)
    }

    cancel(reservationId): Observable<any> {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };

        return this.http.delete(environment.apiUrl + '/tp/' + reservationId, httpOptions)
    }


    create(reservationId): Observable<any> {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };

        return this.http.put(environment.apiUrl + '/tp/' + reservationId + '/reserve/now', httpOptions)
    }

    remove(reservationId): Observable<any> {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };

        return this.http.put(environment.apiUrl + '/tp/' + reservationId + '/reserve/stop', httpOptions)
    }
}
