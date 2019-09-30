import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ConfigService {

    configuration: any

    constructor(private http: HttpClient) {
    }

    get config(): any {
        return this.http.get(
            environment.apiUrl + '/conf',
            {})
    }
}
