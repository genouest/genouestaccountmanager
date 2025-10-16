import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfigService } from 'src/app/config.service';
import { Project, ProjectsService } from 'src/app/admin/projects/projects.service';
import { Group, GroupsService } from 'src/app/admin/groups/groups.service';
import { User, UserService } from 'src/app/user/user.service';
import { Table } from 'primeng/table';

@Component({
    selector: 'app-project',
    templateUrl: './project.component.html',
    styleUrls: ['./project.component.css']
})
export class ProjectComponent implements OnInit {
    @ViewChild('dtp') table: Table;

    config: any;
    project: Project;
    project_expire: string;
    groups: Group[];
    users: User[];
    all_users: User[];
    prj_err_msg: string;
    prj_msg: string;
    oldGroup: string;

    new_user_admin: string = '';
    remove_user_admin: string = '';
    new_manager: string = '';
    rm_manager: string = '';

    admin_user_err_msg: string;
    admin_user_msg: string;

    constructor(
        private route: ActivatedRoute,
        private configService: ConfigService,
        private router: Router,
        private groupService: GroupsService,
        private projectsService: ProjectsService,
        private userService: UserService
    ) {
        this.project = new Project();
        this.users = [];
        this.groups = [];
        this.all_users = [];
        this.config = {};
    }

    ngOnDestroy(): void {}

    ngAfterViewInit(): void {}

    ngOnInit() {
        this.delete_project = this.delete_project.bind(this);
        this.remove_user = this.remove_user.bind(this);
        this.route.params.subscribe(params => {
            let projectId = params.id;
            this.show_project_users(projectId);
        });
        this.groupService.list().subscribe(
            (resp) => (this.groups = resp),
            (err) => console.log('failed to get groups')
        );
        this.userService.list().subscribe(
            (resp) => (this.all_users = resp),
            (err) => console.log('failed to get all users')
        );
        this.configService.config.subscribe(
            (resp) => (this.config = resp),
            (err) => console.log('failed to get config')
        );
    }

    show_project_users(projectId: string) {
        this.projectsService.get(projectId).subscribe(
            (resp) => {
                this.project = resp;
                this.project_expire = this.date_convert(resp.expire);
                this.projectsService.getUsers(projectId).subscribe(
                    (resp) => {
                        this.users = resp;
                        this.oldGroup = this.project.group;
                        for (var i = 0; i < resp.length; i++) {
                            if (
                                resp[i].group.indexOf(this.project.group) >= 0 ||
                                resp[i].secondarygroups.indexOf(this.project.group) >= 0
                            ) {
                                this.users[i].temp = { ...this.users[i].temp, access: true };
                            }
                        }
                        this.remove_user_admin = '';
                        this.new_user_admin = '';
                    },
                    (err) => console.log('failed to get project users')
                );
            },
            (err) => console.log('failed to get project')
        );
    }

    add_manager(new_manager: string) {
        this.admin_user_msg = '';
        this.admin_user_err_msg = '';
        if (!new_manager) {
            this.admin_user_err_msg = 'User id is required';
            return;
        }
        for (var i = 0; i < this.project.managers.length; i++) {
            if (this.project.managers[i] === new_manager) {
                this.admin_user_err_msg = 'User is already a manager';
                return;
            }
        }
        this.projectsService.add_manager(this.project.id, new_manager).subscribe(
            resp => {
                this.admin_user_msg = resp['message']
                this.show_project_users(this.project.id)
            },
            err => this.admin_user_err_msg = err.error.message
        );
    }

    remove_manager(rm_manager: string) {
        this.admin_user_msg = '';
        this.admin_user_err_msg = '';
        if (!rm_manager) {
            this.admin_user_err_msg = 'User id is required';
            return;
        }
        if (this.project.owner === rm_manager) {
            this.admin_user_err_msg = 'The project owner is always a manager';
            return;
        }
        this.projectsService.remove_manager(this.project.id, rm_manager).subscribe(
            resp => {
                this.admin_user_msg = resp['message']
                this.show_project_users(this.project.id);
            },
            err => this.admin_user_err_msg = err.error.message
        );
    }

    add_user() {
        this.admin_user_msg = '';
        this.admin_user_err_msg = '';
        this.userService.addToProject(this.new_user_admin, this.project.id).subscribe(
            (resp) => {
                this.admin_user_msg = resp['message'];
                this.show_project_users(this.project.id);
            },
            (err) => (this.admin_user_err_msg = err.error.message)
        );
    }

    remove_user() {
        this.admin_user_msg = '';
        this.admin_user_err_msg = '';
        this.userService.removeFromProject(this.remove_user_admin, this.project.id).subscribe(
            (resp) => {
                this.admin_user_msg = resp['message'];
                this.show_project_users(this.project.id);
            },
            (err) => (this.admin_user_err_msg = err.error.message)
        );
    }

    // todo: maybe move this in backend too
    update_users_group(usersList: User[], newGroupId: string) {
        for (var i = 0; i < usersList.length; i++) {
            this.userService.addGroup(usersList[i].uid, newGroupId).subscribe(
                (resp) => {},
                (err) => (this.prj_err_msg = err.error.message)
            );
        }
    }

    delete_project() {
        this.admin_user_err_msg = '';
        for (var i = 0; i < this.users.length; i++) {
            this.userService.removeFromProject(this.users[i].uid, this.project.id).subscribe(
                (resp) => {},
                (err) => (this.prj_err_msg = err.error.message)
            );
        }
        this.projectsService.delete(this.project.id).subscribe(
            (resp) => this.router.navigate(['/admin/project'], { queryParams: { deleted: 'ok' } }),
            (err) => (this.admin_user_err_msg = err.error.message)
        );
    }

    update_project() {
        let new_expire = new Date(this.project_expire).getTime();
        if (new_expire != this.project.expire) {
            this.project.last_extended = new Date().getTime();
            this.project.expire = new_expire;
        }
        this.project.group = this.config.project.enable_group ? this.project.group : '';
        this.projectsService.update(this.project.id, this.project).subscribe(
            (resp) => {
                this.prj_msg = resp['message'];
                if (this.config.project.enable_group && this.project.group !== this.oldGroup) {
                    this.update_users_group(this.users, this.project.group);
                }
                this.show_project_users(this.project.id);
            },
            (err) => (this.prj_err_msg = err.error.message)
        );
    }

    date_convert = function timeConverter(tsp: number): string {
        let res;
        try {
            var a = new Date(tsp);
            res = a.toISOString().substring(0, 10);
        } catch (e) {
            res = '';
        }
        return res;
    };
}
