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
    expire: string
    single_user: boolean

    constructor(name: string, type: string, host: string, owner: string, create: boolean = false, usage: string, size: string, expire: string, single_user: boolean) {
        this.name = name
        this.type = type
        this.host = host
        this.owner = owner
        this.create = create
        this.usage = usage
        this.size = size
        this.expire = expire
        this.single_user = single_user

    }

    toJson() {
        return  {
            name: this.name,
            type: this.type,
            host: this.host,
            owner: this.owner,
            create: this.create,
            usage: this.usage,
            size: this.size,
            expire: this.expire,
            single_user: this.single_user,
        }
    }
}


@Injectable({
    providedIn: 'root'
})
export class DatabaseService {

    constructor(private http: HttpClient, private authService: AuthService) { }

    add(db: Database) {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.post(environment.apiUrl + '/database/' + db.name , db.toJson(), httpOptions)
    }
    
    ask(db: Database) {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };
        return this.http.post(environment.apiUrl + '/requestdatabase/' + db.name , db.toJson(), httpOptions)
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
                    return new Database(
                        item.name,
                        item.type,
                        item.host,
                        item.owner,
                        item.create,
                        item.usage,
                        item.size,
                        item.expire,
                        item.single_user,
                    );
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
                    return new Database(
                        item.name,
                        item.type,
                        item.host,
                        item.owner,
                        item.create,
                        item.usage,
                        item.size,
                        item.expire,
                        item.single_user,
                    );
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
        return this.http.delete(environment.apiUrl + '/database/' + db.name, httpOptions)
    }

    changeOwner(dbName, dbOldOwner, dbNewOwner) {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };

        return this.http.put(environment.apiUrl + '/database/' + dbName + '/owner/' + dbOldOwner + '/' + dbNewOwner, {}, httpOptions)
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
            environment.apiUrl + '/pending/database',
            httpOptions
        ).pipe(map((response: any[]) => {
            
            return response.sort(function(a, b) {
                return a.name.localeCompare(b.name);
            });
        }));
    }

    refuse(db) {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };

        return this.http.delete(environment.apiUrl + '/pending/database/' + db.name, httpOptions)
    }

}
