import { Component, OnInit } from '@angular/core';
import { Subject, Observable } from 'rxjs';

import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-logs',
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.css']
})
export class LogsComponent implements OnInit {

  dtTrigger: Subject<any> = new Subject()
  dtOptions: DataTables.Settings = {};

  logs: any
  logcontent: string

  msg: string
  err_msg: string

  event: any

  constructor(private http: HttpClient, private authService: AuthService) { }

  private sortByDate(a, b) {
    if (a.date < b.date)
      return 1;
    if (a.date > b.date)
      return -1;
    return 0;    
  }

  ngOnInit() {
    this.dtOptions = {
      order: [[2, 'desc']]
    };
    this.getLogs().subscribe(
      resp => {
        this.logs = resp.sort(this.sortByDate);
        this.dtTrigger.next();
      },
      err => console.log('failed to get logs')
    )
  }

  ngOnDestroy(): void {
    this.dtTrigger.unsubscribe();
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
    var a = new Date(tsp);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = a.getFullYear();
    //var month = months[a.getMonth()];
    var month = a.getMonth();
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();
    var time = this.addZero(date) + '/' + this.addZero(month) + '/' + year + ' ' + this.addZero(hour) + ':' + this.addZero(min) + ':' + this.addZero(sec) ;
    return time;
  }

  getLogs(): Observable<any> {
    let user = this.authService.profile;
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
    let user = this.authService.profile;
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

  getlog(log_id, event_file) {
    this.logcontent = "";
    this.getLogFile(event_file).subscribe(
      resp => {
      this.logcontent = resp.log.replace(/(\r\n|\n|\r)/g,"<br />");
      this.event = event_file;
      },
      err => this.err_msg = err.error
    );

  }


}
