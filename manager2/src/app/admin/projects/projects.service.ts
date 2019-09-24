import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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
    let user = this.authService.profile;
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
    let user = this.authService.profile;
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
    let user = this.authService.profile;
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
    let user = this.authService.profile;

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
    let user = this.authService.profile;

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
    let user = this.authService.profile;

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
    let user = this.authService.profile;
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

  removeRequest(projectId: string, request: any): Observable<any> {
    let user = this.authService.profile;
    let params = new HttpParams();

    let httpOptions = {
      //headers: new HttpHeaders({
      //  'x-api-key': user.apikey
      //}),
      params: params
    };
    return this.http.put(
        environment.apiUrl + '/project/' + projectId + '/request',
        request,
        httpOptions
        );
  }

  delete(projectId: string): Observable<any> {
    let user = this.authService.profile;
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
}
