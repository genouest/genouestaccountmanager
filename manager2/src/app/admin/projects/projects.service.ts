import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { User, UserService } from 'src/app/user/user.service';
import { AuthService } from '../../auth/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export class Project {
    _id: string;
    uuid: string;
    id: string;
    owner: string;
    group: string;
    size: number;
    current_size: number | null;
    low_size: number | null;
    high_size: number | null;
    cpu: number;
    current_cpu: number | null;
    low_cpu: number | null;
    high_cpu: number | null;
    orga: string;
    description: string;
    access: string;
    path: string;
    expire: number;
    created_at: number;

    constructor(
        _id: string = '', uuid: string = '', id: string = '',
        owner: string = '', group: string = '',
        size: number = 0, current_size: number | null = null,
        low_size: number | null = null, high_size: number | null = null,
        cpu: number = 0, current_cpu: number | null = null,
        low_cpu: number | null = null, high_cpu: number | null = null,
        orga: string = '',  description: string = '',
        access: string =  'Group', path: string = '',
        expire: number = 0, created_at: number = 0
    ) {
        this._id = _id; this.uuid = uuid, this.id = id;
        this.owner = owner; this.group = group; this.size = size;
        this.current_size = current_size; this.low_size = low_size; this.high_size = high_size;
        this.cpu = cpu; this.current_cpu = current_cpu; this.low_cpu = low_cpu; this.high_cpu = high_cpu;
        this.orga = orga; this.description = description; this.access = access; this.path = path;
        this.expire = expire; this.created_at = created_at;
    }
}

@Injectable({
    providedIn: 'root'
})
export class ProjectsService {

    constructor(private http: HttpClient,
        private authService: AuthService,
        private userService: UserService
    ) { }

    private mapToProject(resp: any): Project {
        return new Project(
            resp._id || '', resp.uuid || '', resp.id || '',
            resp.owner || '', resp.group || '',
            resp.size || 0, resp.current_size || null,
            resp.low_size || null, resp.high_size || null,
            resp.cpu || 0, resp.current_cpu || null,
            resp.low_cpu || null, resp.high_cpu || null,
            resp.orga || '', resp.description || '',
            resp.access || 'Group', resp.path || '',
            resp.expire || 0, resp.created_at || 0
        );
    }


    list(getAll: boolean): Observable<Project[]> {
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
            environment.apiUrl + '/project',
            httpOptions
        ).pipe(map((response: any[]) => {
            response.sort(function(a, b) {
                return a.id.localeCompare(b.id);
            });
            return response.map(item => {
                return this.mapToProject(item);
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

    update(projectId: string, project: Project): Observable<any> {
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

    edit(project: Project): Observable<any> {
        //let user = this.authService.profile;
        let params = new HttpParams();

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
            params: params
        };
        return this.http.put(
            environment.apiUrl + '/project',
            project,
            httpOptions
        );
    }

    get(projectId: string): Observable<Project> {
        //let user = this.authService.profile;

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //})
        };
        return this.http.get(
            environment.apiUrl + '/project/' + projectId,
            httpOptions
        ).pipe(map(response => {
            return this.mapToProject(response);
        }));
    }

    getUsers(projectId: string): Observable<User[]> {
        //let user = this.authService.profile;

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //})
        };
        return this.http.get(
            environment.apiUrl + '/project/' + projectId + '/users',
            httpOptions
        ).pipe(map((response: any[]) => {
            return response.map(item => {
                return this.userService.mapToUser(item);
            });
        }));
    }

    getProjectsInGroup(groupName: string): Observable<Project[]> {
        //let user = this.authService.profile;

        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //})
        };
        return this.http.get(
            environment.apiUrl + '/group/' + groupName + '/projects',
            httpOptions
        ).pipe(map((response: any[]) => {
            return response.map(item => {
                return this.mapToProject(item);
            });
        }));
    }

    extend(projectId: string): Observable<any> {
        let httpOptions = {
            // headers: new HttpHeaders({
            //    'Accept': 'application/json'
            // })
        };
        return this.http.get(
            environment.apiUrl + '/project/' + projectId + '/extend/', httpOptions
        )
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

    askNew(new_project: Project): Observable<any> {
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

    list_pending(getAll: boolean): Observable<Project[]> {
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
            response.sort(function(a, b) {
                return a.id.localeCompare(b.id);
            });
            return response.map((item: any) => {
                return this.mapToProject(item);
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

}
