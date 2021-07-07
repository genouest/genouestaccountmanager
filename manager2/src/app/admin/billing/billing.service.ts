import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../auth/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class BillingService {

    constructor(private http: HttpClient, private authService: AuthService) { }

    listPrice(getAll: boolean): Observable<any[]> {
        //let user = this.authService.profile;
        let params = new HttpParams();
        if(getAll) {
            params = params.append("all", "true");
        }

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.get(
            environment.apiUrl + '/price',
            httpOptions
        ).pipe(map((response: any[]) => {
            return response.sort(function (a,b) {
                return a.value - b.value;
            });
        }));
    }

    addPrice(price: any): Observable<any> {
        //let user = this.authService.profile;
        let params = new HttpParams();

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.post(
            environment.apiUrl + '/price',
            price,
            httpOptions
        );
    }

    setPrice(priceUUID: string, state: string): Observable<any> {
        //let user = this.authService.profile;
        let params = new HttpParams();

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.post(
            environment.apiUrl + '/price/' + priceUUID + '/' + state,
            httpOptions
        );
    }

    delPrice(priceUUID: string): Observable<any> {
        //let user = this.authService.profile;
        let params = new HttpParams();

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.delete(
            environment.apiUrl + '/price/' + priceUUID,
            httpOptions
        );
    }


    list(getAll: boolean): Observable<any[]> {
        //let user = this.authService.profile;
        let params = new HttpParams();
        if(getAll) {
            params = params.append("all", "true");
        }

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.get(
            environment.apiUrl + '/bill',
            httpOptions
        ).pipe(map((response: any[]) => {
            return response.sort(function (a,b) {
                return a.status.localeCompare(b.status);
            });
        }));
    }

    addBill(bill: any): Observable<any> {
        //let user = this.authService.profile;
        let params = new HttpParams();

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.post(
            environment.apiUrl + '/bill',
            bill,
            httpOptions
        );
    }

    delBill(billUUID: string): Observable<any> {
        //let user = this.authService.profile;
        let params = new HttpParams();

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.delete(
            environment.apiUrl + '/bill/' + billUUID,
            httpOptions
        );
    }

    updateBill(billUUID: string, bill: any): Observable<any> {
        //let user = this.authService.profile;
        let params = new HttpParams();

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.post(
            environment.apiUrl + '/bill/' + billUUID,
            bill,
            httpOptions
        );
    }

    get(billId: string): Observable<any> {
        //let user = this.authService.profile;

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //})
        };
        return this.http.get(
            environment.apiUrl + '/bill/' + billId,
            httpOptions
        );
    }

    getProjects(billId: string): Observable<any> {
        //let user = this.authService.profile;

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //})
        };
        return this.http.get(
            environment.apiUrl + '/bill/' + billId + '/projects',
            httpOptions
        );
    }

    addProject(billId: string, projectId: string) {
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': localStorage.getItem('my-api-key')
            //}),
        };
        return this.http.post(
            environment.apiUrl + '/bill/' + billId + '/project/' + projectId,
            {},
            httpOptions)
    }

    removeProject(billId: string, projectId: string) {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.delete(
            environment.apiUrl + '/bill/' + billId + '/project/' + projectId,
            httpOptions)
    }

    askNew(new_bill: any): Observable<any> {
        // let user = this.authService.profile;
        let params = new HttpParams();

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.post(
            environment.apiUrl + '/bill',
            new_bill,
            httpOptions
        );
    }

    request(billId: string, request: any): Observable<any> {
        //let user = this.authService.profile;
        let params = new HttpParams();

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.post(
            environment.apiUrl + '/bill/' + billId + '/request',
            request,
            httpOptions
        );
    }



}
