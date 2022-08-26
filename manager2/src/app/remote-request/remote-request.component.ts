import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProjectsService } from 'src/app/admin/projects/projects.service';
import { AuthService } from 'src/app/auth/auth.service';
import { ConfigService } from '../config.service'
import { UserService } from 'src/app/user/user.service';
import { GroupsService } from 'src/app/admin/groups/groups.service';
import { Table } from 'primeng/table';

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

  oldGroup: string

  msg: string
  rm_prj_err_msg: string
  rm_prj_msg_ok: string

  plan_id: string
  ro_id: string

  dmpid: string
  researchoutputid: string


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

    this.dmpid = "2157"
    this.researchoutputid = "2383"
    this.new_project = {}
    this.manager_visible = true;
    this.session_user = await this.authService.profile;


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
        console.log(params); // { order: "popular" }

        this.dmpid = params.plan_id;
        this.researchoutputid = params.ro_id;
        console.log(this.order); // popular
      });
    console.log('getting dmp')
    await this.get_dmp(this.dmpid, this.researchoutputid);
      
  }

  get_dmp(dmpid, researchoutputid) {
    this.dmp_err_msg = ""
    this.dmp_msg = ""
    console.log('here')
    console.log((!(this.new_project.dmpid == null) && !(this.new_project.dmpid == "") && !(this.new_project.researchoutputid == null) && !(this.new_project.researchoutputid == "")))
    if (!(this.dmpid == null) && !(this.dmpid == "") && !(this.researchoutputid == null) && !(this.researchoutputid == "")) {
        this.projectsService.fetch_dmp(dmpid, researchoutputid).subscribe(
            resp => {
                console.log(resp)
                let funders = []
                let data = resp.data.project.funding
                for (data in resp.data.project.funding) {
                    if (resp.data.project.funding[data].fundingStatus == "Approuvé") {
                        funders.push(resp.data.project.funding[data].funder.name)
                    }
                    

                }
                
                console.log(resp.data.researchOutput)
                let research_output = resp.data.researchOutput[0]

                if (research_output == null) {
                    this.dmp_msg = ''
                    this.dmp_err_msg = "No research output was found with this ID"
                }
                this.dmp_msg = resp.message;
                this.dmp_available = true;  
                console.log('description:')
                console.log(research_output)
                console.log(this.convertToPlain(research_output.researchOutputDescription.description))
                this.new_project = {
                    'id': resp.data.project.acronym,
                    'description': this.convertToPlain(research_output.researchOutputDescription.description),
                    'orga': funders,
                    'size': research_output.dataStorage.estimatedVolume,
                    'dmpid': this.dmpid,
                    'researchoutputid': this.researchoutputid
                };
                //AJOUTER CPU, GERER GENOUEST SERVICE REQUEST
                console.log(this.new_project)

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
  // todo: should rename it project_msg
  console.log(this.new_project)
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
