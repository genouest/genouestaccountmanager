import { Component, OnInit, ViewChild } from '@angular/core';
import { Pipe, PipeTransform } from '@angular/core';
import { User, UserService } from 'src/app/user/user.service';

import { Table } from 'primeng/table';

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
        return items.filter((item) => item.status === filter);
    }
}

@Component({
    selector: 'app-users',
    templateUrl: './users.component.html',
    styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit {
    @ViewChild('dt1') table1: Table;
    @ViewChild('dt2') table2: Table;
    @ViewChild('dt3') table3: Table;
    @ViewChild('dt4') table4: Table;

    STATUS_PENDING_EMAIL = 'Waiting for email approval';
    STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
    STATUS_ACTIVE = 'Active';
    STATUS_EXPIRED = 'Expired';

    users: User[];
    pending_email_users: User[] = [];
    pending_approval_users: User[] = [];
    active_users: User[] = [];
    expired_users: User[] = [];

    constructor(private userService: UserService) {}

    ngOnDestroy(): void {}

    ngOnInit() {
        this.userService.list().subscribe(
            (resp) => {
                //this.users = resp;
                let pendingEmail: User[] = [];
                let pendingApproval: User[] = [];
                let active: User[] = [];
                let expired: User[] = [];
                resp.forEach((user) => {
                    if (user.status == this.STATUS_PENDING_EMAIL) {
                        pendingEmail.push(user);
                    } else if (user.status == this.STATUS_PENDING_APPROVAL) {
                        pendingApproval.push(user);
                    } else if (user.status == this.STATUS_ACTIVE) {
                        active.push(user);
                    } else if (user.status == this.STATUS_EXPIRED) {
                        expired.push(user);
                    }
                });
                this.pending_email_users = pendingEmail;
                this.pending_approval_users = pendingApproval;
                this.active_users = active;
                this.expired_users = expired;
            },
            (err) => console.log('failed to get users')
        );
    }
}
