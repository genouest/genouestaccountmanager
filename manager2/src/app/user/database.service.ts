import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export class Database {
    name: string
    type: string
    host: string
    owner: string
    create: boolean
    usage: string
    size: string
    expire: number
    created_at: number
    single_user: boolean
    _id: string

    constructor(
        name: string = '', type: string = 'mysql', host: string = '',
        owner: string = '', create: boolean = false, usage: string = '',
        size: string = '', expire: number = 0, created_at: number = 0,
        single_user: boolean = true, _id: string = ''
    ) {
        this.name = name; this.type = type; this.host = host;
        this.owner = owner; this.create = create; this.usage = usage;
        this.size = size; this.expire = expire; this.created_at = created_at;
        this.single_user = single_user; this._id = _id
    }

    toJson() {
        return {
            name: this.name, type: this.type, host: this.host,
            owner: this.owner, create: this.create, usage: this.usage,
            size: this.size, expire: this.expire, created_at: this.created_at,
            single_user: this.single_user, _id: this._id
        };
    }
}


@Injectable( {
    providedIn: 'root'
})
export class DatabaseService {

    constructor(private http: HttpClient, private authService: AuthService) { }

    mapToDatabase(resp: any): Database {
        return new Database(
            resp.name || '',
            resp.type || 'mysql',
            resp.host || '',
            resp.owner || '',
            resp.create || false,
            resp.usage || '',
            resp.size || '',
            new Date(resp.expire).getTime() || 0,
            new Date(resp.created_at).getTime() || 0,
            resp.single_user || true,
            resp._id || ''
        );
    }

    create(db: Database) {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.post(environment.apiUrl + '/database/create/' + db.name, db.toJson(), httpOptions);
    }

    declare(db: Database) {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.post(environment.apiUrl + '/database/declare/' + db.name, db.toJson(), httpOptions);
    }
    
    ask(db: Database) {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.post(environment.apiUrl + '/database/request/' + db.name, db.toJson(), httpOptions);
    }

    list(): Observable<Database[]> {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };

        return this.http.get(environment.apiUrl + '/database', httpOptions)
            .pipe(map((response: any) => {
                return response.map(item => {
                    return this.mapToDatabase(item);
                });
            }));
    }

    listOwner(id: string): Observable<Database[]> {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };

        return this.http.get(environment.apiUrl + '/database/owner/' + id, httpOptions)
            .pipe(map((response: any) => {
                return response.map(item => {
                    return this.mapToDatabase(item);
                });
            }));
    }

    remove(db: Database) {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.delete(environment.apiUrl + '/database/' + db.name, httpOptions);
    }

    changeOwner(dbName: string, dbOldOwner: string, dbNewOwner: string) {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.put(environment.apiUrl + '/database/' + dbName + '/owner/' + dbOldOwner + '/' + dbNewOwner, { }, httpOptions);
    }

    list_pending(getAll: boolean): Observable<Database[]> {
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
            environment.apiUrl + '/pending/database',
            httpOptions
        ).pipe(map((response: any[]) => {
            response.sort(function(a, b) {
                return a.name.localeCompare(b.name);
            });
            return response.map(item => {
                return this.mapToDatabase(item)
            })
        }));
    }

    refuse(db: Database) {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.delete(environment.apiUrl + '/pending/database/' + db.name, httpOptions);
    }
}
