import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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

constructor(name: string, type: string, host: string, owner: string, create: boolean = false) {
this.name = name
this.type = type
this.host = host
this.owner = owner
this.create = create
}

toJson() {
return  {
name: this.name,
type: this.type,
host: this.host,
owner: this.owner,
create: this.create
}
}
}


@Injectable({
providedIn: 'root'
})
export class DatabaseService {

constructor(private http: HttpClient, private authService: AuthService) { }

add(db: Database) {
let user = this.authService.profile;
let httpOptions = {
//headers: new HttpHeaders({
//  'x-api-key': user.apikey
//}),
};
return this.http.post(environment.apiUrl + '/database/' + db.name , db.toJson(), httpOptions)
}

list(): Observable<Database[]> {
let user = this.authService.profile;
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
item.owner
);
});
}));
}

listOwner(id: string): Observable<Database[]> {
let user = this.authService.profile;
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
item.owner
);
});
}));
}

remove(db: Database) {
let user = this.authService.profile;
let httpOptions = {
//headers: new HttpHeaders({
//  'x-api-key': user.apikey
//}),
};
return this.http.delete(environment.apiUrl + '/database/' + db.name, httpOptions)
}

changeOwner(dbName, dbOldOwner, dbNewOwner) {
let user = this.authService.profile;
let httpOptions = {
//headers: new HttpHeaders({
//  'x-api-key': user.apikey
//}),
};

return this.http.put(environment.apiUrl + '/database/' + dbName + '/owner/' + dbOldOwner + '/' + dbNewOwner, {}, httpOptions)
}

}
