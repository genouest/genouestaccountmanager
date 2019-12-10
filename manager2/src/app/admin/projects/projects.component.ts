import { Component, OnInit, ViewChild, QueryList, ViewChildren } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ProjectsService } from 'src/app/admin/projects/projects.service';
import { GroupsService } from 'src/app/admin/groups/groups.service';
import { UserService } from 'src/app/user/user.service';

import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';

@Component({
    selector: 'app-projects',
    templateUrl: './projects.component.html',
    styleUrls: ['./projects.component.css']
})
export class ProjectsComponent implements OnInit {
    @ViewChildren(DataTableDirective)
    tables: QueryList<DataTableDirective>;


    dtTriggerAdd: Subject<any> = new Subject()
    dtTriggerRemove: Subject<any> = new Subject()
    dtTriggerProjects: Subject<any> = new Subject()

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

    constructor(
        private route: ActivatedRoute,
        private projectService: ProjectsService,
        private groupService: GroupsService,
        private userService: UserService
    ) { }

    ngOnDestroy(): void {
        this.dtTriggerAdd.unsubscribe();
        this.dtTriggerRemove.unsubscribe();
        this.dtTriggerProjects.unsubscribe();
    }

    // TODO sort groups by name

    ngOnInit() {
        this.route.queryParams
            .subscribe(params => {
                if(params.deleted == "ok") {
                    this.notification = "Project was deleted successfully";
                };
            });

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
            expire: new Date(),
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
    }

    ngAfterViewInit(): void {
        //this.dtTriggerProjects.next();
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
                        this.userService.addGroup(user_id, project.group).subscribe(
                            resp => this.request_grp_msg = resp['message'],
                            err => this.request_mngt_error_msg = err.error
                        )
                    },
                    err => this.request_mngt_error_msg = err.error
                )
            },
            err => this.request_mngt_error_msg = err.error
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
                    err => this.request_mngt_error_msg = err.error
                )
            },
            err => this.request_mngt_error_msg = err.error
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
            err => this.request_mngt_error_msg = err.error
        )
    }

    add_project(){
        this.notification = "";
        if(! this.new_project.id || ! this.new_project.group || ! this.new_project.owner) {
            this.add_project_error_msg = "Project Id, group, and owner are required fields " + this.new_project.id + this.new_project.group + this.new_project.owner ;
            return;
        }
        this.add_project_msg = '';
        this.add_project_error_msg = '';
        this.projectService.add({
            'id': this.new_project.id,
            'owner': this.new_project.owner,
            'group': this.new_project.group,
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
                                           resp => {
                                               this.userService.addGroup(this.new_project.owner, this.new_project.group).subscribe(
                                                   resp => {},
                                                   err => {
                                                       console.log('failed to add user to group');
                                                       this.add_project_error_msg = err.error;

                                                   }
                                               )
                                           },
                                           err => {
                                               console.log('failed  to add user to project');
                                               this.add_project_error_msg = err.error;
                                           }
                                       )

                                   },
                                   err => {
                                       console.log('failed to add project', this.new_project);
                                       this.add_project_error_msg = err.error;
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
                        this.renderDataTables('dtAddRequests');
                    }
                    if (data[i]["remove_requests"]){
                        for(var j=0;j<data[i]["remove_requests"].length;j++){
                            this.remove_requests.push({'project': data[i], 'user': data[i]["remove_requests"][j]});
                        }
                        this.requests_number += data[i]["remove_requests"].length;
                        this.renderDataTables('dtRemoveRequests');
                    }
                }
                if(this.requests_number > 0){this.requests_visible = true;};
                this.projects = data;
                this.renderDataTables('dtProjects');
            },
            err => console.log('failed to get projects')
        );

    }

    renderDataTables(table): void {
        if ($('#' + table).DataTable() !== undefined) {
            $('#' + table).DataTable().clear();
            $('#' + table).DataTable().destroy();
        }
        if (table == 'dtProjects') {
            this.dtTriggerProjects.next();
        } else if (table == 'dtAddRequests') {
            this.dtTriggerAdd.next();
        } else if (table == 'dtRemoveRequests') {
            this.dtTriggerRemove.next();
        }
    }

    date_convert = function timeConverter(tsp){
        var a = new Date(tsp);
        return a.toLocaleDateString();
    }
}
