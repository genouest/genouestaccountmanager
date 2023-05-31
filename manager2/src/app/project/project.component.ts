import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectsService } from 'src/app/admin/projects/projects.service';
import { AuthService } from 'src/app/auth/auth.service';
import { ConfigService } from '../config.service'
import { UserService } from 'src/app/user/user.service';
import { GroupsService } from 'src/app/admin/groups/groups.service';

import { Table } from 'primeng/table';
import { THIS_EXPR } from '@angular/compiler/src/output/output_ast';
import { data } from 'jquery';

@Component({
    selector: 'app-project',
    templateUrl: './project.component.html',
    styleUrls: ['./project.component.css']
})
export class ProjectComponent implements OnInit {
    @ViewChild('dtp') table: Table;
    @ViewChild('dtu') tableuser: Table;


    new_project: any
    projects: any
    users: any
    groups: any
    selectedProject: any
    session_user: any
    config: any
    new_user: any
    remove_user: any
    default_size: any
    dmp: any
    dmp_err_msg: string;
    dmp_msg: string;
    dmp_available: boolean;
    dmp_visible: boolean;
    default_cpu: any

    manager_visible: boolean

    request_err_msg: string
    request_msg: string

    oldGroup: string

    msg: string
    rm_prj_err_msg: string
    rm_prj_msg_ok: string

    constructor(
        private authService: AuthService,
        private configService: ConfigService,
        private projectsService: ProjectsService,
        private userService: UserService,
        private groupService: GroupsService,
        private router: Router
    ) {
        this.config = {}
        this.default_size = 0
        this.default_cpu = 0
    }

    ngOnDestroy(): void {
    }

    async ngOnInit() {

        this.new_project = {}
        this.groups = [];
        this.manager_visible = true;
        this.dmp_visible = false;
        this.session_user = await this.authService.profile;
        this.users = [];

        this.project_list();

        this.configService.config.subscribe(
            resp => {
                this.config = resp;
                if (this.config.project) {
                    if (this.config.project.default_size) {
                        this.default_size = this.config.project.default_size;
                    }
                    if (this.config.project.default_cpu) {
                        this.default_cpu = this.config.project.default_cpu;
                    }
                }
                this.new_project.size = this.default_size
                this.new_project.cpu = this.default_cpu
            },
            err => console.log('failed to get config')
        )

    }

    project_list() {
        this.projectsService.list(false).subscribe(
            resp => {
                for (var i = 0; i < resp.length; i++) {
                    if (resp[i].size && resp[i].current_size) {
                        resp[i].low_size = resp[i].size / 3;
                        resp[i].high_size = 2 * resp[i].size / 3;
                    }
                    if (resp[i].cpu && resp[i].current_cpu) {
                        resp[i].low_cpu = resp[i].cpu / 3;
                        resp[i].high_cpu = 2 * resp[i].cpu / 3;
                    }
                }
                this.projects = resp;
            },
            err => console.log('failed to get projects')
        )

    }

    ask_for_project() {
        // todo: should rename it project_msg
        this.request_msg = '';
        this.request_err_msg = '';
        if (!this.new_project.id) {
            this.request_err_msg = 'Project name is mandatory';
            return;
        }
        this.projectsService.askNew(this.new_project).subscribe(
            resp => {
                this.request_msg = 'An email have been sent to admin';
                this.new_project = {};
            },
            err => {
                console.log('failed to get project users', err);
                this.request_err_msg = err.error.message;
            }
        )
    }

    show_project_users(project) {
        return new Promise((resolve, reject) => {
            this.msg = '';
            this.rm_prj_err_msg = '';
            this.rm_prj_msg_ok = '';
            let project_name = project.id;

            this.projectsService.getUsers(project_name).subscribe(
                resp => {
                    this.users = resp;
                    this.selectedProject = project;
                    this.oldGroup = project.group;
                    for (let i = 0; i < resp.length; i++) {
                        if (resp[i].group.indexOf(this.selectedProject.group) >= 0 || resp[i].secondarygroups.indexOf(this.selectedProject.group) >= 0) {
                            this.users[i].access = true;
                        }
                    }
                    resolve(resp)
                },
                err => {
                    console.log('failed to get project users')
                    reject(err)
                }
        )
        })
    }

    async show_project_users_and_scroll(project, anchor) {
        this.show_project_users(project).then(() => {
            return new Promise(f => setTimeout(f, 250));
        }).then(() => {
            this.scroll(anchor)
        }).catch(err => this.request_err_msg = err.error.message)

    }

    extend(project) {
        this.projectsService.extend(project.id).subscribe(
            resp => {
                this.request_msg = resp['message'];
                this.project_list();
                this.selectedProject = null; // to avoid multiple click on the extend button
            },
            err => {
                this.request_err_msg = err.error.message;
                console.log('failed to extend user', err)
            }
        )
    }

    request_user(project, user_id, request_type) {
        this.request_msg = '';
        this.request_err_msg = '';
        if (!user_id) {
            this.request_err_msg = 'User id is required';
            return;
        };
        if (request_type === "add") {
            for (var i = 0; i < this.users.length; i++) {
                if (this.users[i].uid === user_id) {
                    this.request_err_msg = 'User is already in project';
                    return;
                }
            }
        }
        if (request_type === "remove" && project.owner === user_id) {
            this.request_err_msg = 'You cannot remove the project owner';
            return;
        }
        if (request_type === "remove" && this.session_user.uid === user_id) {
            // Self removal
            this.userService.removeFromProject(user_id, project.id).subscribe(
                resp => {
                    this.request_msg = resp['message'];
                    this.project_list();
                },
                err => {
                    this.request_err_msg = err.error.message;
                }
            )
            return;
        }
        // Owner request
        this.projectsService.request(project.id, { 'request': request_type, 'user': user_id }).subscribe(
            resp => {
                this.request_msg = resp['message']
                this.show_project_users(project).catch(err => this.request_err_msg = err.error.message); // update user list
            },
            err => this.request_err_msg = err.error.message
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

    scroll(el: HTMLElement) {
        el.scrollIntoView({behavior: 'smooth'});
    }
    get_dmp(dmpUuid) {
        this.dmp_err_msg = ""
        this.dmp_msg = ""
        
        if (!(this.new_project.dmpUuid == null) && !(this.new_project.dmpUuid == "")) {
            this.projectsService.fetch_dmp(dmpUuid).subscribe(
                resp => {
                    let funders = []
                    let data = resp.project.funding
                    for (data in resp.project.funding) {
                        if (resp.project.funding[data].fundingStatus == "Approuvé" || resp.project.funding[data].fundingStatus == "Granted") {
                            funders.push(resp.project.funding[data].funder.name)
                        }
                        
                    }
                    let research_output = resp.researchOutput[0];
                    
                    if (research_output == null) {
                        this.dmp_msg = ''
                        this.dmp_err_msg = "No research output was found with this ID"
                    }
                    this.dmp_msg = resp.message;
                    this.dmp_available = true;  
                    this.new_project = {
                        'id': resp.project.acronym,
                        'description': this.convertToPlain(research_output.dataStorage.genOuestServiceRequest[0].initialRequest.justification),
                        'orga': funders,
                        'cpu': research_output.dataStorage.genOuestServiceRequest[0].initialRequest.cpuUsage,
                        'size': research_output.dataStorage.genOuestServiceRequest[0].initialRequest.dataSize,
                        'dmpUuid': this.new_project.dmpUuid,
                        'expire': research_output.dataStorage.genOuestServiceRequest[0].initialRequest.endStorageDate,
                    };

                },
                err => {
                    this.dmp_err_msg = err.error.message
                    this.dmp_available = false;
                }
            )
        }
        else {
            this.dmp_err_msg = "Please enter a valid ID"
        }
        
    }

    display_dmp_to_user() {
        this.dmp_visible = !this.dmp_visible;

        this.projectsService.fetch_dmp(this.selectedProject.dmpUuid).subscribe(
            resp => {this.dmp = resp;
            },
            err => console.log( err + 'dmperr')
        );
    }
    
    convertToPlain(html){

        // Create a new div element
        var tempDivElement = document.createElement("div");
        
        // Set the HTML content with the given value
        tempDivElement.innerHTML = html;
        
        // Retrieve the text property of the element 
        return tempDivElement.textContent || tempDivElement.innerText || "";
    }

}
