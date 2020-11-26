import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ConfigService } from 'src/app/config.service';
import { ProjectsService } from 'src/app/admin/projects/projects.service';
import { GroupsService } from 'src/app/admin/groups/groups.service';
import { UserService } from 'src/app/user/user.service';
import * as latinize from 'latinize'

import {Table} from 'primeng/table'

@Component({
    selector: 'app-projects',
    templateUrl: './projects.component.html',
    styleUrls: ['./projects.component.css']
})
export class ProjectsComponent implements OnInit {
    @ViewChild('dtp') table: Table;
    @ViewChild('dta') tableadd: Table;
    @ViewChild('dtd') tabledel: Table;

    config: any

    notification: string
    requests_visible: boolean
    requests_number: number

    request_mngt_msg: string
    request_grp_msg: string
    request_mngt_error_msg: string

    add_project_msg: string
    add_project_error_msg: string

    add_requests: any[]
    remove_requests: any[]

    projects: any[]
    groups: any[]
    all_users: any[]
    new_project: any
    
    dmp_msg: any
    dmp_err_msg: any

    day_time: number


    default_path: any
    default_size: any

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
                if(params.deleted == "ok") {
                    this.notification = "Project was deleted successfully";
                };
            });

        this.default_path = "";
        this.default_size = 0;
        this.requests_visible = false;
        this.add_requests = [];
        this.remove_requests = [];
        this.projects = [];
        this.groups = [];
        this.all_users = [];
        this.new_project = {
            id: '',
            owner: '',
            group: '',
            size: 0,
            expire: '',
            orga: '',
            description: '',
            access: 'Group',
            path: ''
        }

        this.project_list(true);
        this.groupService.list().subscribe(
            resp => {
                this.groups = resp;
                if (this.groups.length > 0) {
                    this.new_project.group =this.groups[0].name;
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
                if (this.config.project && this.config.project.default_path) {
                    this.default_path = this.config.project.default_path;
                }
                if (this.config.project && this.config.project.default_size) {
                    this.default_size = this.config.project.default_size;
                }
            },
            err => console.log('failed to get config')
        );

    }

    ngAfterViewInit(): void {
    }

    validate_add_request(project, user_id) {
        this.notification = "";
        this.request_mngt_msg = "";
        this.request_mngt_error_msg = "";
        this.request_grp_msg = "";
        this.userService.addToProject(user_id, project.id).subscribe(
            resp => {
                this.request_mngt_msg = resp['message'];
                this.projectService.removeRequest(project.id, {'request': 'add', 'user': user_id}).subscribe(
                    resp => {
                        this.project_list(true);
                    },
                    err => this.request_mngt_error_msg = err.error.message
                )
            },
            err => this.request_mngt_error_msg = err.error.message
        )
    }

    validate_remove_request(project, user_id) {
        this.notification = "";
        this.request_mngt_msg = "";
        this.request_mngt_error_msg = "";
        this.request_grp_msg = "";
        this.userService.removeFromProject(user_id, project.id).subscribe(
            resp => {
                this.request_mngt_msg = resp['message'];
                this.projectService.removeRequest(project.id, {'request': 'remove', 'user': user_id}).subscribe(
                    resp => this.project_list(true),
                    err => this.request_mngt_error_msg = err.error.message
                )
            },
            err => this.request_mngt_error_msg = err.error.message
        )
    }

    remove_request(project, user_id, request_type) {
        this.notification = "";
        this.request_mngt_msg = "";
        this.request_mngt_error_msg = "";
        this.request_grp_msg = "";
        this.projectService.removeRequest(project.id, {'request': request_type, 'user': user_id}).subscribe(
            resp => {
                this.request_mngt_msg = resp['message'];
                this.project_list(true);
            },
            err => this.request_mngt_error_msg = err.error.message
        )
    }


    update_project_on_event(new_value) {
        let tmpprojectid = latinize(new_value.toLowerCase()).replace(/[^0-9a-z]+/gi,'_');
        this.new_project.path = this.config.project.default_path + '/' +  tmpprojectid;
        // warning: for this.new_project.id, (ngModelChange) must be after [ngModel] in html line
        // about order, see: https://medium.com/@lukaonik/how-to-fix-the-previous-ngmodelchange-previous-value-in-angular-6c2838c3407d
        this.new_project.id = tmpprojectid; // todo: maybe add an option to enable or disable this one
    }


    add_project(){
        this.notification = "";

        if(! this.new_project.id || (this.config.project.enable_group && ! this.new_project.group) || ! this.new_project.owner) {
            this.add_project_error_msg = "Project Id, group, and owner are required fields " + this.new_project.id + this.new_project.group + this.new_project.owner ;
            return;
        }
        this.add_project_msg = '';
        this.add_project_error_msg = '';
        this.projectService.add({
            'id': this.new_project.id,
            'owner': this.new_project.owner,
            'group': this.config.project.enable_group ? this.new_project.group : '',
            'size': this.new_project.size,
            'description': this.new_project.description,
            'access': this.new_project.access,
            'orga': this.new_project.orga,
            'path': this.new_project.path,
            'expire': new Date(this.new_project.expire).getTime()}
                               ).subscribe(
                                   resp => {
                                       this.add_project_msg = resp.message;
                                       this.project_list();
                                       this.userService.addToProject(this.new_project.owner, this.new_project.id).subscribe(
                                           resp => {},
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

    project_list(refresh_requests = false){
        this.projects = [];
        this.projectService.list(true).subscribe(
            resp => {
                if(resp.length == 0) {
                    return;
                }
                if(refresh_requests) {
                    this.add_requests = [];
                    this.remove_requests = [];
                    this.requests_number = 0;
                }
                let data = resp;
                for(var i=0;i<data.length;i++){
                    data[i].expire = new Date(data[i].expire);
                    if (! refresh_requests){ continue;};
                    if (data[i]["add_requests"]){
                        for(var j=0;j<data[i]["add_requests"].length;j++){
                            this.add_requests.push({'project': data[i], 'user': data[i]["add_requests"][j]});
                        }
                        this.requests_number += data[i]["add_requests"].length;
                    }
                    if (data[i]["remove_requests"]){
                        for(var j=0;j<data[i]["remove_requests"].length;j++){
                            this.remove_requests.push({'project': data[i], 'user': data[i]["remove_requests"][j]});
                        }
                        this.requests_number += data[i]["remove_requests"].length;
                    }
                }
                if(this.requests_number > 0){this.requests_visible = true;};
                this.projects = data;
            },
            err => console.log('failed to get projects')
        );

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

    request_dmp_data() {
        console.log(this.new_project.dmp_key)
        this.dmp_msg = '';
        this.dmp_err_msg = '';
        if ([undefined, ""].includes(this.new_project.dmp_key)) {
            this.dmp_err_msg = 'The DMP key field is empty';
            return;
        }
        this.projectService.askDmpData(this.new_project).subscribe(
            resp => {
                this.dmp_msg = 'Successfuly loaded the DMP data';
                console.log(resp.ping)

            },
            err => {
                console.log('failed to reach the DMP database with your key', err);
                this.dmp_err_msg = err.error;
            }
        )
    }
}
