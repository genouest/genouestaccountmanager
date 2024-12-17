import { Component, OnInit, ViewChild } from '@angular/core';
import { Group, GroupsService } from './groups.service';
import { Project, ProjectsService } from 'src/app/admin/projects/projects.service';
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

    success_msg: string
    err_msg: string
    rm_grp_msg_ok: string
    rm_grp_err_msg: string
    msg: string

    selectedGroup: Group
    new_group: Group

    projects: Project[]
    groups: Group[]
    users: User[]

    constructor(
        private groupsService: GroupsService,
        private projectsService: ProjectsService
    ) {
        this.selectedGroup = null;
        this.new_group = new Group();
        this.projects = [];
        this.groups = [];
        this.users = [];
    }

    ngAfterViewInit(): void {
    }


    ngOnDestroy(): void {

    }

    ngOnInit() {
        this.groupsService.list().subscribe(
            resp => {
                this.groups = resp;
            },
            err => console.log('failed to get groups')
        )
    }

    addGroup(){
        if (this.new_group.name === '') {
            return;
        }
        this.err_msg = '';
        this.success_msg = '';
        this.groupsService.add(this.new_group).subscribe(
            resp => {
                this.success_msg = 'Group was created';
                this.groupsService.list().subscribe(
                    resp => {
                        this.groups = resp;
                    },
                    err => console.log('failed to get groups')
                )
            },
            err => {
                this.success_msg = '';
                this.err_msg = err.error.message;
            }
        )
    }
}
