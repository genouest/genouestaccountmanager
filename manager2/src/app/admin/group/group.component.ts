import { Component, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { ConfigService } from "src/app/config.service";
import { Group, GroupsService } from "../groups/groups.service";
import { Project, ProjectsService } from "../projects/projects.service";
import { User } from "../../user/user.service";
import { Table } from "primeng/table";

@Component({
	selector: "app-groups",
	templateUrl: "./group.component.html",
	// styleUrls: ['./group.component.css']
})
export class GroupComponent implements OnInit {
	@ViewChild("dtg") tableGroups: Table;
	@ViewChild("dtu") tableUsers: Table;

	success_msg: string;
	err_msg: string;
	msg: string;
	group: Group;
	projects: Project[];
	users: User[];

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

	ngOnDestroy(): void {}

	ngAfterViewInit(): void {}

	ngOnInit() {
		this.route.params.subscribe((params) => {
			let group_name = params.id;
			this.groupsService.get(group_name).subscribe(
				(resp) => (this.group = resp),
				(err) => console.log("failed to get project")
			);
			this.groupsService.getUsers(group_name).subscribe(
				(resp) => (this.users = resp),
				(err) => console.log("failed to get project users")
			);
		});
	}

	deleteGroup() {
		this.groupsService.delete(this.group.name).subscribe(
			(resp) => (this.group = null),
			(err) => (this.err_msg = err.error.message)
		);
	}

	updateGroup() {
		this.groupsService.update(this.group).subscribe(
			(resp) => {
				this.msg = "Group updated";
				this.err_msg = "";
			},
			(err) => {
				this.msg = "";
				this.err_msg = err.error.message;
			}
		);
	}

    show_group_users(input_group: any) {
        const group: Group = this.groupsService.mapToGroup(input_group);
        this.msg = '';
        this.projectsService.getProjectsInGroup(group.name).subscribe(
            resp => {
                this.projects = resp;
                this.groupsService.getUsers(group.gid).subscribe(
                    user_list => {
                        this.users = user_list;
                        for(var i = 0; i < user_list.length; i++){
                            var is_authorized = false;
                            if(user_list[i].projects){
                                for(var j = 0; j < this.projects.length; j++){
                                    if(user_list[i].projects.indexOf(this.projects[j].id) >= 0){
                                        is_authorized = true;
                                        break;
                                    }
                                }
                            }
                            this.users[i].temp = { ...this.users[i].temp, 'authorized': is_authorized };
                        }
                    },
                    err => console.log('failed to get users in group', group)
                )
            },
            err => console.log('failed to get projects in group')
        )
    }
}
