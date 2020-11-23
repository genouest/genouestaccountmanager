import { Component, OnInit, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';

import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../auth/auth.service';
import { Table } from 'primeng/table';

@Component({
    selector: 'app-logs',
    templateUrl: './logs.component.html',
    styleUrls: ['./logs.component.css']
})
export class LogsComponent implements OnInit {
    @ViewChild('dtp') table: Table;



    logs: any
    logcontent: string

    msg: string
    err_msg: string

    event: any

    constructor(private http: HttpClient, private authService: AuthService) { }

    // it look like this is useless, as in fact in compare string, not date ...
    private sortByDate(a, b) {
        if (a.date < b.date)
            return 1;
        if (a.date > b.date)
            return -1;
        return 0;
    }

    ngOnInit() {
        this.getLogs().subscribe(
            resp => {
                this.logs = resp.sort(this.sortByDate);
            },
            err => console.log('failed to get logs')
        )
    }

    ngOnDestroy(): void {
    }

    get_status = function(status){
        if(status!=0 && status!=undefined) {
            return "alert alert-warning";
        }
    }

    addZero = function addZeroBefore(n:number) {
        return (n < 10 ? '0' : '') + n;
    }

    date_convert = function timeConverter(tsp){
        let res;
        try {
            var a = new Date(tsp);
            res = a.toISOString().substring(0, 10);
        }
        catch (e) {
            res = '';
        }
        return res;
    }

    getLogs(): Observable<any> {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //})
        };
        return this.http.get(
            environment.apiUrl + '/log',
            httpOptions
        );
    }

    getLogFile(event_file): Observable<any> {
        //let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //})
        };
        return this.http.get(
            environment.apiUrl + '/log/' + event_file,
            httpOptions
        );
    }

    getlog(_log_id, event_file) {
        this.logcontent = "";
        this.getLogFile(event_file).subscribe(
            resp => {
                this.logcontent = resp.log.replace(/(\r\n|\n|\r)/g,"<br />");
                this.event = event_file;
            },
            err => this.err_msg = err.error.message
        );

    }


}
