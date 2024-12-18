import { Component, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Group, GroupsService } from "../groups/groups.service";
import { Project, ProjectsService } from "../projects/projects.service";
import { User } from "../../user/user.service";
import { Table } from "primeng/table";

@Component({
    selector: "app-groups",
    templateUrl: "./group.component.html"
    // styleUrls: ['./group.component.css']
})
export class GroupComponent implements OnInit {
    @ViewChild("dtg") tableGroups: Table;
    @ViewChild("dtu") tableUsers: Table;

    msg: string;
    err_msg: string;
    del_err_msg: string;
    group: Group;
    projects: Project[];
    users: User[];

    constructor(
        private route: ActivatedRoute,
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
        this.deleteGroup = this.deleteGroup.bind(this);
        this.route.params.subscribe((params) => {
            let group_name = params.id;
            this.groupsService.get(group_name).subscribe(
                (group) => (this.group = group),
                (err) => console.log("failed to get group")
            );
            this.projectsService.getProjectsInGroup(group_name).subscribe(
                (project_list) => (this.projects = project_list),
                (err) => console.log("failed to get projects in group")
            );
            this.groupsService.getUsers(group_name).subscribe(
                (user_list) => {
                    this.users = user_list;
                    for (var i = 0; i < user_list.length; i++) {
                        var is_authorized = false;
                        if (user_list[i].projects) {
                            for (var j = 0; j < this.projects.length; j++) {
                                if (user_list[i].projects.indexOf(this.projects[j].id) >= 0) {
                                    is_authorized = true;
                                    break;
                                }
                            }
                        }
                        this.users[i].temp = {
                            ...this.users[i].temp,
                            authorized: is_authorized
                        };
                    }
                },
                (err) => console.log("failed to get group's users")
            );
        });
    }

    deleteGroup() {
        this.groupsService.delete(this.group.name).subscribe(
            (resp) =>
                this.router.navigate(["/admin/group"], {
                    queryParams: { deleted: "ok" }
                }),
            (err) => (this.del_err_msg = err.error.message)
        );
    }

    updateGroup() {
        this.msg = "";
        this.err_msg = "";
        this.groupsService.update(this.group).subscribe(
            (resp) => (this.msg = "Group updated"),
            (err) => (this.err_msg = err.error.message)
        );
    }
}
