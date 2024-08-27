import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Project, ProjectsService } from 'src/app/admin/projects/projects.service';
import { AuthService } from 'src/app/auth/auth.service';
import { ConfigService } from '../config.service'
import { User, UserService } from 'src/app/user/user.service';

import { Table } from 'primeng/table';

@Component({
    selector: 'app-project',
    templateUrl: './project.component.html',
    styleUrls: ['./project.component.css']
})
export class ProjectComponent implements OnInit {
    @ViewChild('dtp') table: Table;
    @ViewChild('dtu') tableuser: Table;
    @ViewChild('formModal') formModal: ElementRef;
    @ViewChild('terms_and_conditions_hds') terms_and_conditions_hds;

    new_project: Project
    new_project_expire: string
    projects: Project[]
    users: User[]
    selectedProject: Project
    session_user: User
    config: any
    new_user: string
    remove_user: string
    default_size: number
    default_cpu: number

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
        private userService: UserService
    ) {
        this.config = {}
        this.default_size = 0
        this.default_cpu = 0
    }

    async ngOnInit() {

        this.new_project = new Project();
        this.new_project_expire = '';
        this.manager_visible = true;
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

    ask_for_project(form: NgForm) {
        if (form.valid) {
            // todo: should rename it project_msg
            this.request_msg = '';
            this.request_err_msg = '';
            this.new_project.expire = new Date(this.new_project_expire).getTime();
            this.projectsService.askNew(this.new_project).subscribe(
                resp => {
                    this.request_msg = 'An email has been sent to an admin';
                    this.new_project = new Project();
                    this.new_project_expire = '';
                    this.closeFormModal();
                },
                err => {
                    console.log('failed to get project users', err);
                    this.request_err_msg = err.error.message;
                }
            )
        } else {
            form.control.markAllAsTouched();
            console.log('Form is invalid');
        }
    }

    closeFormModal() {
        const formModalElement = this.formModal.nativeElement;
        formModalElement.style.display = 'none';
        const modalBackdrop = document.querySelector('.modal-backdrop');
        if (modalBackdrop) {
            modalBackdrop.remove();
        }
    }

    show_project_users(project: Project) {
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
                        if ((resp[i].group.indexOf(this.selectedProject.group) >= 0) || (resp[i].secondarygroups.indexOf(this.selectedProject.group) >= 0)) {
                            this.users[i].temp = { ...this.users[i].temp, access: true };
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

    async show_project_users_and_scroll(input_project: any, anchor: HTMLElement) {
        const project: Project = this.projectsService.mapToProject(input_project);
        this.show_project_users(project).then(() => {
            return new Promise(f => setTimeout(f, 250));
        }).then(() => {
            this.scroll(anchor)
        }).catch(err => this.request_err_msg = err.error.message)

    }

    extend(input_project: any) {
        const project: Project = this.projectsService.mapToProject(input_project);
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

    request_user(input_project: any, user_id: string, request_type: string) {
        const project: Project = this.projectsService.mapToProject(input_project);
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

    scroll(el: HTMLElement) {
        el.scrollIntoView({behavior: 'smooth'});
    }
}
