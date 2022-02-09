import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
// import { HttpsClient, HttpsParams } from '@angular/common/https';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../auth/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class ProjectsService {

    constructor(private http: HttpClient, private authService: AuthService) { }


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
            environment.apiUrl + '/project',
            httpOptions
        ).pipe(map((response: any[]) => {
            return response.sort(function (a,b) {
                return a.id.localeCompare(b.id);
            });
        }));
    }

    add(project: any): Observable<any> {
        //let user = this.authService.profile;
        let params = new HttpParams();

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.post(
            environment.apiUrl + '/project',
            project,
            httpOptions
        );
    }

    update(projectId: string, project: any): Observable<any> {
        //let user = this.authService.profile;
        let params = new HttpParams();

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.post(
            environment.apiUrl + '/project/' + projectId,
            project,
            httpOptions
        );
    }

    get(projectId: string): Observable<any> {
        //let user = this.authService.profile;

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //})
        };
        return this.http.get(
            environment.apiUrl + '/project/' + projectId,
            httpOptions
        );
    }

    getUsers(projectId: string): Observable<any> {
        //let user = this.authService.profile;

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //})
        };
        return this.http.get(
            environment.apiUrl + '/project/' + projectId + '/users',
            httpOptions
        );
    }

    getProjectsInGroup(groupName: string): Observable<any> {
        //let user = this.authService.profile;

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //})
        };
        return this.http.get(
            environment.apiUrl + '/group/' + groupName + '/projects',
            httpOptions
        );
    }

    request(projectId: string, request: any): Observable<any> {
        //let user = this.authService.profile;
        let params = new HttpParams();

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.post(
            environment.apiUrl + '/project/' + projectId + '/request',
            request,
            httpOptions
        );
    }

    delete(projectId: string): Observable<any> {
        //let user = this.authService.profile;
        let params = new HttpParams();

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.delete(
            environment.apiUrl + '/project/' + projectId,
            httpOptions
        );
    }

    askNew(new_project: any): Observable<any> {
        // let user = this.authService.profile;
        let params = new HttpParams();

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.post(
            environment.apiUrl + '/ask/project',
            new_project,
            httpOptions
        );
    }

    list_pending(getAll: boolean): Observable<any[]> {
        //let user = this.authService.profile;
        let params = new HttpParams();
        if (getAll) {
            params = params.append("all", "true");
        }

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.get(
            environment.apiUrl + '/pending/project',
            httpOptions
        ).pipe(map((response: any[]) => {
            return response.sort(function (a, b) {
                return a.id.localeCompare(b.id);
            });
        }));
    }

    delete_pending(projectUuid: string): Observable<any> {
        //let user = this.authService.profile;
        let params = new HttpParams();

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.delete(
            environment.apiUrl + '/pending/project/' + projectUuid,
            httpOptions
        );
        }

    fetch_dmp(dmpid: string, researchoutputid: string): Observable<any> {
        //Gets DMP data from DMP_Opidor then autofills some info( and will store the data in mongo)
        // let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        console.log(dmpid)
        console.log(researchoutputid)
        return this.http.post(
            environment.apiUrl + '/dmp/' + dmpid + '/' + researchoutputid,
            httpOptions
        );
        }
}
