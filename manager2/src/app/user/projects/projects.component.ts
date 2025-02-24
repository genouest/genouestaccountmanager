import { Component, OnInit, Input } from '@angular/core';
import { User, UserService } from '../user.service';
import { Project } from '../../admin/projects/projects.service';

@Component({
    selector: 'app-user-projects',
    templateUrl: './projects.component.html',
    styleUrls: ['./projects.component.css']
})
export class ProjectsComponent implements OnInit {
    @Input() projects: Project[];
    @Input() user_projects: any[];
    @Input() user: User;

    add_to_project_msg: string;
    add_to_project_grp_msg: string;
    add_to_project_error_msg: string;
    remove_from_project_msg: string;
    remove_from_project_error_msg: string;
    request_mngt_error_msg: string;

    project: Project;

    constructor(private userService: UserService) {}

    ngOnInit() {
        this.remove_from_project = this.remove_from_project.bind(this);
    }

    add_to_project() {
        this.add_to_project_msg = '';
        this.add_to_project_grp_msg = '';
        this.add_to_project_error_msg = '';
        this.request_mngt_error_msg = '';
        let new_project = this.user.newproject;
        for (var i = 0; i < this.user_projects.length; i++) {
            if (new_project.id === this.user_projects[i].id) {
                this.add_to_project_error_msg = 'User is already in project';
                return;
            }
        }
        if (new_project) {
            this.userService.addToProject(this.user.uid, new_project.id).subscribe(
                (resp) => {
                    this.add_to_project_msg = resp['message'];
                    this.user_projects.push({ id: new_project.id, is_owner: false, is_manager: false, is_member: true });
                },
                (err) => this.add_to_project_error_msg = err.error.message
            );
        }
    }

    remove_from_project(project_id) {
        this.userService.removeFromProject(this.user.uid, project_id).subscribe(
            (resp) => {
                this.remove_from_project_msg = resp['message'];
                let tmpproject = [];
                for (var t = 0; t < this.user_projects.length; t++) {
                    if (this.user_projects[t].id != project_id) {
                        tmpproject.push(this.user_projects[t]);
                    }
                }
                this.user_projects = tmpproject;
            },
            (err) => this.remove_from_project_error_msg = err.error.message
        );
    }
}
