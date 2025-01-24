import { Component, OnInit, ViewChild } from '@angular/core';
import { Group, GroupsService } from './groups.service';
import { ActivatedRoute } from '@angular/router';
import { User } from '../../user/user.service';
import { Table } from 'primeng/table';

@Component({
    selector: 'app-groups',
    templateUrl: './groups.component.html',
    styleUrls: ['./groups.component.css']
})
export class GroupsComponent implements OnInit {
    @ViewChild('dtg') tableGroups: Table;
    @ViewChild('dtu') tableUsers: Table;

    notification: string
    success_msg: string
    err_msg: string
    selectedGroup: Group
    new_group: Group
    groups: Group[]
    users: User[]

    constructor(
        private route: ActivatedRoute,
        private groupsService: GroupsService
    ) {
        this.new_group = new Group();
        this.groups = [];
        this.users = [];
    }

    ngAfterViewInit(): void {
    }


    ngOnDestroy(): void {

    }

    ngOnInit() {
        this.route.queryParams
            .subscribe(params => {
                if (params.deleted == 'ok') {
                    this.notification = 'Group was deleted successfully';
                };
            });
        this.listGroups();
    }

    addGroup() {
        this.notification = '';
        if (this.new_group.name === '') { return; }
        this.err_msg = '';
        this.success_msg = '';
        this.groupsService.add(this.new_group).subscribe(
            resp => {
                this.success_msg = 'Group was created';
                this.listGroups();
            },
            err => this.err_msg = err.error.message
        )
    }

    listGroups() {
        this.groupsService.list().subscribe(
            resp => (this.groups = resp),
            err => console.log('failed to get groups')
        )
    }
}
