import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProjectsService } from 'src/app/admin/projects/projects.service';
import { AuthService } from 'src/app/auth/auth.service';
import { ConfigService } from '../config.service'
import { UserService } from 'src/app/user/user.service';
import { GroupsService } from 'src/app/admin/groups/groups.service';
import { Table } from 'primeng/table';
import {Router} from "@angular/router"

@Component({
  selector: 'app-remote-request',
  templateUrl: './remote-request.component.html',
  styleUrls: ['./remote-request.component.css']
})
export class RemoteRequestComponent implements OnInit {
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
  order: any
  request_err_msg: string
  request_msg: string
  project_request_success: boolean
  oldGroup: string

  msg: string

  dmpUuid: string


  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private projectsService: ProjectsService,
    private userService: UserService,
    private groupService: GroupsService,
    private route: ActivatedRoute


  ) {
    this.config = {}
        this.default_size = 0
        this.default_cpu = 0
   }

  async ngOnInit() {


    this.new_project = {}
    this.manager_visible = true;
    this.session_user = await this.authService.profile;
    this.project_request_success = false;

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

    await this.route.queryParams.subscribe(params => {

        this.dmpUuid = params.dmpUuid;
      });
    await this.get_dmp(this.dmpUuid);
      
  }

  get_dmp(dmpUuid) {
    this.dmp_err_msg = ""
    this.dmp_msg = ""
    if (!(this.dmpUuid == null) && !(this.dmpUuid == "") ) {
        this.projectsService.fetch_dmp(dmpUuid).subscribe(
            resp => {
                let funders = []
                let data = ""
                for (data in resp.project.funding) {
                    if (resp.project.funding[data].fundingStatus == "Approuvé" || resp.project.funding[data].fundingStatus == "Granted") {
                        funders.push(resp.project.funding[data].funder.name)
                    }
                }      
                let research_output = resp.researchOutput[0]

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
                    'dmpUuid': this.dmpUuid,
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
remote_project_request() {
  this.request_msg = '';
  this.request_err_msg = '';
  for (let data in this.new_project) {
    if (data == undefined) {
        this.request_err_msg = 'Your DMP is missing essential information';
        return;
    }
  }
  
  this.projectsService.askNew(this.new_project).subscribe(
      resp => {
          this.request_msg = 'An email has been sent to admin';
          this.project_request_success = true;
          this.new_project = {};
      },
      err => {
          console.log(err);
          this.request_err_msg = err.error.message;
      }
  )
}


convertToPlain(html){

  // Create a new div element
  var tempDivElement = document.createElement("div");
  
  // Set the HTML content with the given value
  tempDivElement.innerHTML = html;
  
  // Retrieve the text property of the element 
  return tempDivElement.textContent || tempDivElement.innerText || "";
}
isNumber(val): boolean { return typeof val === 'number'; }
isString(val): boolean { return typeof val === 'string'; }
}
