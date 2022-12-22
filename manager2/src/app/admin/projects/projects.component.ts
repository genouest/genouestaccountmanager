import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ConfigService } from 'src/app/config.service';
import { ProjectsService } from 'src/app/admin/projects/projects.service';
import { GroupsService } from 'src/app/admin/groups/groups.service';
import { UserService } from 'src/app/user/user.service';
import * as latinize from 'latinize'

import { Table } from 'primeng/table'


@Component({
    selector: 'app-projects',
    templateUrl: './projects.component.html',
    styleUrls: ['./projects.component.css']
})
export class ProjectsComponent implements OnInit {
    @ViewChild('dtp') table: Table;
    @ViewChild('dta') tableadd: Table;
    @ViewChild('dtd') tabledel: Table;
    @ViewChild('dtw') tablepending: Table;
    @ViewChild('dte') tableexpired: Table;

    config: any

    notification: string
    requests_visible: boolean
    pending_number: number

    add_project_msg: string
    add_project_error_msg: string

    pending_projects: any[]
    projects: any[]
    expired_projects: any[]
    groups: any[]
    all_users: any[]
    new_project: any

    day_time: number

    pending_msg: any
    pending_err_msg: any

    default_path: any
    default_size: any
    default_cpu: any

    constructor(
        private route: ActivatedRoute,
        private configService: ConfigService,
        private projectService: ProjectsService,
        private groupService: GroupsService,
        private userService: UserService
    ) {
        this.config = {};
        this.day_time = 1000 * 60 * 60 * 24;
    }

    ngOnDestroy(): void {
    }

    // TODO sort groups by name

    ngOnInit() {
        this.route.queryParams
            .subscribe(params => {
                if (params.deleted == "ok") {
                    this.notification = "Project was deleted successfully";
                };
            });
        this.pending_number = 0;
        this.default_path = "";
        this.default_size = 0;
        this.default_cpu = 0;
        this.requests_visible = false;
        this.pending_projects = [];
        this.projects = [];
        this.expired_projects = [];
        this.groups = [];
        this.all_users = [];
        this.new_project = {
            id: '',
            owner: '',
            group: '',
            size: 0,
            cpu: 0,
            expire: '',
            orga: '',
            description: '',
            access: 'Group',
            path: ''
        }

        this.project_list(true);
        this.pending_list(true);
        this.groupService.list().subscribe(
            resp => {
                this.groups = resp;
                if (this.groups.length > 0) {
                    this.new_project.group = this.groups[0].name;
                }
            },
            err => console.log('failed to get groups')
        );
        this.userService.list().subscribe(
            resp => this.all_users = resp,
            err => console.log('failed to get all users')
        );

        this.configService.config.subscribe(
            resp => {
                this.config = resp;
                this.new_project.expire = this.date_convert(new Date().getTime() + this.config.project.default_expire * this.day_time)
                if (this.config.project) {
                    if (this.config.project.default_path) {
                        this.default_path = this.config.project.default_path;
                    }
                    if (this.config.project.default_size) {
                        this.default_size = this.config.project.default_size;
                    }
                    if (this.config.project.default_cpu) {
                        this.default_cpu = this.config.project.default_cpu;
                    }
                }
            },
            err => console.log('failed to get config')
        );

    }

    ngAfterViewInit(): void {
    }


    update_project_on_event(new_value) {
        let tmpprojectid = latinize(new_value.toLowerCase()).replace(/[^0-9a-z]+/gi, '_');
        this.new_project.path = this.config.project.default_path + '/' + tmpprojectid;
        // warning: for this.new_project.id, (ngModelChange) must be after [ngModel] in html line
        // about order, see: https://medium.com/@lukaonik/how-to-fix-the-previous-ngmodelchange-previous-value-in-angular-6c2838c3407d
        this.new_project.id = tmpprojectid; // todo: maybe add an option to enable or disable this one

        if (!this.new_project.expire) {
            this.new_project.expire = this.date_convert(new Date().getTime() + this.config.project.default_expire * this.day_time)
        }

        if (!this.new_project.size || this.new_project.size == 0) {
            this.new_project.size = this.default_size;
        }

        if (!this.new_project.cpu || this.new_project.cpu == 0) {
            this.new_project.cpu = this.default_cpu;
        }
    }


    add_project() {
        this.notification = "";

        if (!this.new_project.id || (this.config.project.enable_group && !this.new_project.group) || !this.new_project.owner) {
            this.add_project_error_msg = "Project Id, group, and owner are required fields " + this.new_project.id + this.new_project.group + this.new_project.owner;
            return;
        }
        this.reset_msgs()
        this.projectService.add({
            'uuid': this.new_project.uuid,
            'id': this.new_project.id,
            'owner': this.new_project.owner,
            'group': this.config.project.enable_group ? this.new_project.group : '',
            'size': this.new_project.size,
            'cpu': this.new_project.cpu,
            'description': this.new_project.description,
            'access': this.new_project.access,
            'orga': this.new_project.orga,
            'path': this.new_project.path,
            'expire': new Date(this.new_project.expire).getTime()
        }).subscribe(
            resp => {
                this.add_project_msg = resp.message;
                this.project_list();
                this.pending_list(true);

                this.userService.addToProject(this.new_project.owner, this.new_project.id).subscribe(
                    resp => {
                        this.new_project = {};
                    },
                    err => {
                        console.log('failed  to add user to project');
                        this.add_project_error_msg = err.error.message;
                    }
                )
            },
            err => {
                console.log('failed to add project', this.new_project);
                this.add_project_error_msg = err.error.message;
            }
        );
    }

    project_list(refresh_requests = false) {
        this.projects = [];
        this.expired_projects = [];
        this.projectService.list(true).subscribe(
            resp => {
                if (resp.length == 0) {
                    return;
                }
                let projects = resp;
                let expired_projects = [];
                let active_projects = [];
                for (let i = 0; i < projects.length; i++) {
                    if (projects[i].size && projects[i].current_size) {
                        projects[i].low_size = projects[i].size / 3;
                        projects[i].high_size = 2 * projects[i].size / 3;
                    }
                    if (projects[i].cpu && projects[i].current_cpu) {
                        projects[i].low_cpu = projects[i].cpu / 3;
                        projects[i].high_cpu = 2 * projects[i].cpu / 3;
                    }
                    if (projects[i].expire > Date.now()) {
                        active_projects.push(projects[i]);
                    } else {
                        expired_projects.push(projects[i]);
                    }
                    if(!projects[i].created_at) {
                        projects[i].created_at = parseInt(projects[i]['_id'].substring(0, 8), 16) * 1000
                    }
                }
                this.projects = active_projects;
                this.expired_projects = expired_projects;
            },
            err => console.log('failed to get projects')
        );
    }

    pending_list(refresh_requests = false) {
        this.pending_projects = [];
        this.projectService.list_pending(true).subscribe(
            resp => {
                if (resp.length == 0) {
                    this.pending_number = 0;
                    return;
                }
                if (refresh_requests) {
                    this.pending_number = 0;
                }
                let data = resp;
                if (data.length > 0) { 
                    this.requests_visible = true;
                    for (let i = 0; i < data.length; i++) {
                        data[i].created_at = parseInt(data[i]['_id'].substring(0, 8), 16) * 1000
                    }
                };
                this.pending_number = data.length;
                this.pending_projects = data;
            },
            err => console.log('failed to get pending projects')
        );
    }


    date_convert = function timeConverter(tsp) {
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

    accept_project(project) {
        this.modify_project(project);
        this.add_project();
    }

    modify_project(project) {
        this.new_project = project;
        this.update_project_on_event(project.id);
    }

    reject_project(project) {
        this.reset_msgs()
        this.projectService.delete_pending(project.uuid).subscribe(
            resp => {
                this.pending_msg = resp.message;
                this.pending_list(true);
            },
            err => this.pending_err_msg = err.error
        );

    }

    reset_msgs() {
        this.add_project_msg = "";
        this.add_project_error_msg = "";
        this.pending_msg = "";
        this.pending_err_msg = "";
    }
}
