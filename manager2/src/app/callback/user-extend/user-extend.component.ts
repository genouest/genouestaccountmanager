import { Component, OnInit } from '@angular/core';
import { UserService } from 'src/app/user/user.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-user-extend',
  templateUrl: './user-extend.component.html',
  styleUrls: ['./user-extend.component.css']
})
export class UserExtendComponent implements OnInit {

  msg: string
  expiration: string

  constructor(
    private userService: UserService,
    private routeService: ActivatedRoute
  ) { }

  ngOnInit() {
    this.routeService.queryParams
    .subscribe(params => {
      this.userService.extend(params.id, params.regkey).subscribe(
        resp => {
          this.msg = resp['message'];
          this.expiration = this.date_convert(resp['expiration']);
        },
        err => {
          this.msg = 'Failed to extend account';
          this.expiration = '';
          console.log('failed to extend user')
        }
      )
    });
  }

  date_convert = function timeConverter(tsp){
    var a = new Date(tsp);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();
    var time = date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
    return time;
  }

}
