import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfigService } from 'src/app/config.service';
import { Group, GroupsService } from '../groups/groups.service';
import { Project, ProjectsService } from 'src/app/admin/projects/projects.service';
import { User } from '../../user/user.service';
import { Table } from 'primeng/table';

@Component( {
    selector: 'app-groups',
    templateUrl: './group.component.html'
    // styleUrls: ['./group.component.css']
} )
export class GroupComponent implements OnInit {
    @ViewChild('dtg') tableGroups: Table;
    @ViewChild('dtu') tableUsers: Table;

    success_msg: string
    err_msg: string
    msg: string
    group: Group
    projects: Project[]
    users: User[]

    constructor(
        private route: ActivatedRoute,
        private configService: ConfigService,
        private router: Router,
        private groupsService: GroupsService,
        private projectsService: ProjectsService
    ) {
        this.group = new Group();
        this.projects = null;
        this.users = null;
    }

    ngOnDestroy(): void {
    }

    ngAfterViewInit(): void {
    }

    ngOnInit() {
        this.route.params.subscribe(params => {
            let group_name = params.id;
            this.show_group_users(group_name);
        });
    }

    show_group_users(group_name: string) {
        this.groupsService.get(group_name).subscribe(
            resp => {
                this.group = resp;
                this.groupsService.getUsers(group_name).subscribe(
                    resp => {
                        this.users = resp;
                        for(var i = 0; i < resp.length; i++) {
                            // if(resp[i].group.indexOf(this.project.group) >= 0 || resp[i].secondarygroups.indexOf(this.project.group) >= 0) {
                            //     this.users[i].temp = { ...this.users[i].temp, 'access': true };
                            // }
                        }
                    },
                    err => console.log('failed to get project users')
                )
            },
            err => console.log('failed to get project')
        )
    }

    deleteGroup() {
        this.groupsService.delete(this.group.name).subscribe(
            resp => {
                this.group = null;
            },
            err => {
                this.err_msg = err.error.message;
            }
        )
    }

    updateGroup() {
        this.groupsService.update(this.group).subscribe(
            resp => {
                this.msg = 'Group updated';
                this.err_msg = '';
            },
            err => {
                this.msg = '';
                this.err_msg = err.error.message;
            }
        )
    }
}
