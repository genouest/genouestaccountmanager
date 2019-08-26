import { Component, OnInit } from '@angular/core';
import { Pipe, PipeTransform } from '@angular/core';
import { UserService } from 'src/app/user/user.service';

import { Subject } from 'rxjs';

@Pipe({
  name: 'statusFilter',
  pure: false
})
export class MyStatusFilterPipe implements PipeTransform {
  transform(items: any[], filter: string): any {
      if (!items || !filter) {
          return items;
      }
      // filter items array, items which match and return true will be
      // kept, false will be filtered out
      return items.filter(item => item.status === filter);
  }
}

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit {

  dtTrigger: Subject<any> = new Subject()

  STATUS_PENDING_EMAIL = 'Waiting for email approval';
  STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
  STATUS_ACTIVE = 'Active';
  STATUS_EXPIRED = 'Expired';

  users: any

  constructor(private userService: UserService) { }

  ngOnDestroy(): void {
    this.dtTrigger.unsubscribe();
  }

  ngOnInit() {
    this.userService.list().subscribe(
      resp => {
        this.users = resp;
        this.dtTrigger.next();
      },
      err => console.log('failed to get users')
    )
  }

    get_ssh_key(id, name) {
      return this.userService.getSshKey(id, name);
  }

  date_convert(tsp) {
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
