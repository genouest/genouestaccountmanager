import { Component, OnInit, Input } from '@angular/core';
import { UserService } from '../user.service';

@Component({
    selector: 'app-user-projects',
    templateUrl: './projects.component.html',
    styleUrls: ['./projects.component.css']
})
export class ProjectsComponent implements OnInit {
    @Input() projects: any[]
    @Input() user_projects: any[]
    @Input() user: any

    add_to_project_msg: string
    add_to_project_grp_msg: string
    add_to_project_error_msg: string
    remove_from_project_msg: string
    remove_from_project_error_msg: string
    request_mngt_error_msg: string

    project: any

    constructor(private userService: UserService) { }

    ngOnInit() {
        this.remove_from_project = this.remove_from_project.bind(this);
    }

    add_to_project(){
        this.add_to_project_msg = "";
        this.add_to_project_grp_msg = "";
        this.add_to_project_error_msg = "";
        this.request_mngt_error_msg = "";
        let newproject = this.user.newproject;
        for(var i=0; i<this.user_projects.length; i++){
            if(newproject.id === this.user_projects[i].id){
                this.add_to_project_error_msg = "User is already in project";
                return;
            }
        }
        if(newproject){
            this.userService.addToProject(this.user.uid, newproject.id).subscribe(
                resp => {
                    this.add_to_project_msg = resp['message'];
                    this.user_projects.push({id: newproject.id, owner: false, member: true});
                },
                err => {
                    this.add_to_project_error_msg = err.error.message;
                }
            )
        };
    }

    remove_from_project(project_id){
        this.userService.removeFromProject(this.user.uid, project_id).subscribe(
            resp => {
                this.remove_from_project_msg = resp['message'];
                let tmpproject = [];
                for(var t=0;t<this.user_projects.length;t++){
                    if(this.user_projects[t].id != project_id) {
                        tmpproject.push(this.user_projects[t]);
                    }
                }
                this.user_projects = tmpproject;
            },
            err => {
                this.remove_from_project_error_msg = err.error.message;
            }
        )
    }

}
