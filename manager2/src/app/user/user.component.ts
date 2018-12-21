import { Component, OnInit, OnDestroy } from '@angular/core'
import { UserService } from './user.service'
import { AuthService } from '../auth/auth.service'
import { ConfigService } from '../config.service'
import { Website, WebsiteService } from './website.service'
import { Database, DatabaseService} from './database.service'
import { Plugin, PluginService} from '../plugin/plugin.service'
import { GroupsService } from '../admin/groups/groups.service'
import { ProjectsService } from '../admin/projects/projects.service'


import { ActivatedRoute, Router } from '@angular/router';
import { forEach } from '@angular/router/src/utils/collection';
import { PluginItems } from '../plugin/plugin.component';
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { WindowWrapper } from '../windowWrapper.module';


/*
function _window() : any {
  // return the global native browser window object
  return window;
}

@Injectable()
export class WindowRefService {
  get nativeWindow() : any {
     return _window();
  }
}
*/


@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.css']
})
export class UserComponent implements OnInit {

  dtTrigger: Subject<any> = new Subject()
  dtOptions: DataTables.Settings = {};

  user_projects: any[]
  projects: any[]
  user: any
  session_user: any
  config: any
  groups: any[]
  subscribed: boolean
  selected_group: any
  quotas: any = []
  u2f: any
  timeoutId: any

  STATUS_PENDING_EMAIL = 'Waiting for email approval'
  STATUS_PENDING_APPROVAL = 'Waiting for admin approval'
  STATUS_ACTIVE = 'Active'
  STATUS_EXPIRED = 'Expired'

  private sub: any

  website: Website
  websites: Website[]

  database: Database
  databases: Database[]

  plugins: any[]
  plugin_data: any

  events: any = []

  panel: number = 0;

  // Password mngt
  wrong_confirm_passwd: string
  update_passwd: string
  password1: string
  password2: string

  // Error messages
  msg: string
  err_msg: string

  add_to_project_msg: string
  add_to_project_error_msg: string
  add_to_project_grp_msg: string
  request_mngt_error_msg: string

  remove_from_project_msg: string
  remove_from_project_error_msg: string

  ssh_message: string

  update_msg: string
  update_error_msg: string

  new_key_message: string

  add_group_msg: string
  rm_group_msg: string

  webmsg: string
  rmwebmsg: string

  del_msg: string

  dbmsg: string
  dbmsg_error: string
  rm_dbmsg: string
  rm_dbmsg_error: string

  constructor(
    private route: ActivatedRoute,
    private userService: UserService,
    private authService: AuthService,
    private configService: ConfigService,
    private websiteService: WebsiteService,
    private databaseService: DatabaseService,
    private pluginService: PluginService,
    private groupService: GroupsService,
    private projectService: ProjectsService,
    private router: Router,
    private window: WindowWrapper
    ) {
    this.dtOptions = {
        order: [[0, 'desc']]
    };
    this.projects = []
    this.user_projects = []
    this.session_user = this.authService.profile
    this.user = {}
    this.config = {}
    this.website = new Website('', '', '', '')
    this.websites = []
    this.database = new Database('', 'mysql', '', '', true)
    this.databases = []
    this.plugins = []
    this.plugin_data = {}
    this.subscribed = false
    this.groups = []

  }

  dateConvert = function timeConverter(tsp){
    var a = new Date(tsp);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();
    var time = date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
    return time;
  }

  ngOnInit() {

    this.web_delete = this.web_delete.bind(this);
    this.delete_secondary_group = this.delete_secondary_group.bind(this);
    this.db_delete = this.db_delete.bind(this);
    this.delete = this.delete.bind(this);

    this.configService.config.subscribe(
      resp => this.config = resp,
      err => console.log('failed to get config')
    )

    this.userService.isSubscribed().subscribe(
      resp =>{
        this.subscribed = resp['subscribed']
      },
      err => {console.log('subscribedError',err);}
    )
    this.sub = this.route.params.subscribe(params => {
      this.pluginService.list().subscribe(
        resp => this.plugins = resp,
        err => console.log('failed to get plugins:', err)
      )
      this.userService.getUser(params['id']).subscribe(
        resp => {
          if (!resp['u2f']) { resp['u2f'] = {}}
          this.user = resp;
          this.loadUserInfo();
        },
        err => console.log('failed to get user ', params['id'])
      )
    });
  }

  _compareName(a,b) {
    if (a.name < b.name)
      return -1;
    if (a.name > b.name)
      return 1;
    return 0;
  }

  _compareId(a,b) {
    if (a.id < b.id)
      return -1;
    if (a.id > b.id)
      return 1;
    return 0;
  }

  _loadGroups(groups) {
    groups.sort(this._compareName)
    this.groups = groups;
    let found = false;
    for(let i=0;i<groups.length;i++){
      if(groups[i].name == this.user.group) {
        found = true;
        break;
      }
    }
    if(!found) { this.groups.push({name: this.user.group})}
  }

  _loadProjects(projects) {
    this.projects = projects;
    let user_projects = [];
    for(let i=0; i<projects.length;i++){
        if(this.user.projects == null){ this.user.projects = []; }
        if (this.user.projects.indexOf(projects[i].id) >= 0){
            let is_owner = false;
            let user_in_group = false;
            if(this.user.uid === projects[i].owner){
                is_owner = true;
            }
            if(this.user.group.indexOf(projects[i].group) >= 0 || this.user.secondarygroups.indexOf(projects[i].group >= 0)){
                user_in_group = true;
            }
            user_projects.push({id: projects[i].id, owner: is_owner, group: projects[i].group, member: user_in_group});
        }
    }
    user_projects.sort(this._compareId)
    this.user_projects = user_projects;   
  }

  loadUserInfo() {
    if(this.session_user.is_admin) {
      this.groupService.list().subscribe(
        resp => this._loadGroups(resp),
        err => console.log('failed to get groups')
      )
      this.projectService.list(true).subscribe(
        resp => this._loadProjects(resp),
        err => console.log('failed to get projects')
      )      
    }
    this.web_list();
    this.db_list();
    this.userService.getUserLogs(this.user.uid).subscribe(
      resp => {
        this.events=resp;
        this.dtTrigger.next();
      },
      err => console.log('failed to get events')
    );
  }

  db_list() {
    this.databaseService.listOwner(this.user.uid).subscribe(
      resp => this.databases = resp,
      err => console.log('failed to get databases')
    )
  }

  db_add() {
    this.dbmsg='';
    this.dbmsg_error='';
    this.databaseService.add(this.database).subscribe(
      resp => { this.dbmsg = resp['message']; this.db_list()},
      err => { this.dbmsg_error = err.error; console.log('failed to add database')}
    )  
  }

  db_delete(dbName: string) {
    this.rm_dbmsg = '';
    this.rm_dbmsg_error = '';
    this.databases.forEach((ws)=>{
      if(ws.name == dbName) {
        this.databaseService.remove(ws).subscribe(
          resp => { this.rm_dbmsg = resp['message']; this.db_list()},
          err => { this.rm_dbmsg_error = err.error; console.log('failed to delete database')}
        )
      }
    });
  }    

  web_list() {
    this.websiteService.listOwner(this.user.uid).subscribe(
      resp => this.websites = resp,
      err => console.log('failed to get web sites')
    )
  }

  web_add() {
    this.website.owner = this.user.uid;
    this.websiteService.add(this.website).subscribe(
      resp => {
        this.webmsg = '';
        this.websites.push(this.website);
        this.website = new Website('', '', '', this.user.uid);
        //this.web_list();
      },
      err => { this.webmsg = err.error; console.log('failed to add web site')}
    )
  }
  web_delete(siteName: string) {
    this.websites.forEach((ws)=>{
      if(ws.name == siteName) {
        this.websiteService.remove(ws).subscribe(
          resp => { this.rmwebmsg = ''; this.web_list()},
          err  => { this.rmwebmsg = err.error; console.log('failed to delete web site', err)}
        )
      }
    });
  }

  add_secondary_group() {
    let sgroup =this.user.newgroup;
      if(sgroup.trim()!=''){
        this.userService.addGroup(this.user.uid, sgroup).subscribe(
          resp => {
            this.add_group_msg = resp['message'];
            this.user.secondarygroups.push(sgroup);
          },
          err => console.log('failed to add secondary group')
        )
        
      }
  }

  delete_secondary_group(sgroup) {
    this.userService.deleteGroup(this.user.uid, sgroup).subscribe(
      resp => {
        this.rm_group_msg = resp['message'];
        let tmpgroups = [];
        for(var t=0;t<this.user.secondarygroups.length;t++){
          if(this.user.secondarygroups[t] != sgroup) {
            tmpgroups.push(this.user.secondarygroups[t]);
          }
        }
        this.user.secondarygroups = tmpgroups;
      },
      err => console.log('failed to remove from secondary group')
    )
  }

  expire() {
    this.userService.expire(this.user.uid).subscribe(
      resp => {
        this.msg = resp['message'];
        this.user.status = this.STATUS_EXPIRED;
      },
      err => console.log('failed to expire user')
    )
  }

  extend() {
    this.userService.extend(this.user.uid, this.user.regkey).subscribe(
      resp => {
        this.msg = resp['message'];
        this.user.expiration = resp['expiration']
      },
      err => console.log('failed to extend user')
    )
  }

  renew(){
    this.userService.renew(this.user.uid).subscribe(
      resp => {
        this.msg = resp['message'],
        this.user.status = this.STATUS_ACTIVE;
      },
      err => console.log('failed to renew')
    )
  }
  
  switchTo(panel) {
    this.panel = panel
  }

  generate_apikey(uid: string){
      this.userService.generateApiKey(this.user.uid).subscribe(
      resp => {
        this.user.apikey = resp['apikey'];
        this.authService.updateApiKey(this.user.apikey);
      },
      err => console.log('failed to generate apikey')
      );
  }

  ssh_new_key(){
    this.userService.getNewSSHKey(this.user.uid).subscribe(
      resp => this.new_key_message = resp['msg'],
      err => console.log('failed to get new ssh key')
    )
  }

  update_password(){
    this.wrong_confirm_passwd = "";
    this.update_passwd = "";
    if((this.password1 != this.password2) || (this.password1=="")) {
        this.wrong_confirm_passwd = "Passwords are not identical";
        return;
    }
    if(this.password1.length < 10) {
        this.wrong_confirm_passwd = "Password must have 10 characters minimum";
        return;
    }
    this.userService.updatePassword(this.user.uid, this.password1).subscribe(
      resp => this.update_passwd = resp['message'],
      err => console.log('failed to update password')
    )
 
  }

  change_group() {
    this.user.group = this.selected_group.name;
  }

  update_info() {
    this.update_msg = '';
    this.update_error_msg = '';
    this.userService.update(this.user.uid, this.user).subscribe(
      resp => {
        this.update_msg = 'User info updated';
        this.user = resp;
      },
      err => this.update_error_msg = err.error
    )
  }

  update_ssh(){
    this.ssh_message = '';
    this.userService.updateSSH(this.user.uid, this.user.ssh).subscribe(
      resp => {
        this.user = resp;
        this.ssh_message = 'SSH key updated';
      },
      err => {
        console.log('failed to update ssh')
      }
    )
  }

  activate() {
    this.err_msg = '';
    this.msg = '';
    this.userService.activate(this.user.uid).subscribe(
      resp => {
        this.user.status = this.STATUS_ACTIVE;
        this.msg = resp['msg']
      },
      err => this.err_msg = err.error
    )
  }

  register_u2f() {
    this.userService.u2fGet(this.user.uid).subscribe(
      resp => {
        let registrationRequest = resp['registrationRequest'];
        this.u2f = "Please insert your key and press button";
        //this.timeoutId = setTimeout(function(){
          let ctx =this;
          this.window['u2f'].register(
            registrationRequest.appId, [registrationRequest], [], registrationResponse => {
              if(registrationResponse.errorCode) {
                console.log("Association failed");
                ctx.u2f = "Assocation failed";
                return;
            }
            // Send this registration response to the registration verification server endpoint
            let data = {
                registrationRequest: registrationRequest,
                registrationResponse: registrationResponse
            }
            ctx.userService.u2fSet(this.user.uid, data).subscribe(
              resp => {
                ctx.u2f = null;
                ctx.user.u2f = {'publicKey': resp['publicKey']};
              },
              err => console.log('failed to register device')
            )
            }, 5000)

        //}, 5000);
      },
      err => console.log('failed to get u2f devices')
    )
  }

  add_to_project() {
    this.add_to_project_msg = '';
    this.add_to_project_error_msg = '';
    this.add_to_project_grp_msg = '';
    this.request_mngt_error_msg = '';
    let newproject = this.user.newproject;
    for(var i=0; i< this.user_projects.length; i++){
      if(newproject.id === this.user_projects[i].id){
          this.add_to_project_error_msg = "User is already in project";
          return;
      }
    }
    if(newproject) {
      this.userService.addToProject(this.user.uid, newproject.id).subscribe(
        resp =>  {
          this.add_to_project_msg = resp['message'];
          this.userService.addGroup(this.user.uid, newproject.group).subscribe(
            resp => {
              this.add_to_project_grp_msg = resp['message'];
              this.user_projects.push({id: newproject.id, owner: false, member: true})
            },
            err => this.request_mngt_error_msg = err.error
          )
        },
        err => this.add_to_project_error_msg = err.error
      )
    }

  }

  remove_from_project(project_id) {
    this.userService.removeFromProject(this.user.uid, project_id, false).subscribe(
      resp => {
        this.remove_from_project_msg = resp['message'];
        var tmpproject = [];
            for(var t=0;t<this.user_projects.length;t++){
                if(this.user_projects[t].id != project_id) {
                    tmpproject.push(this.user_projects[t]);
                }
            }
            this.user_projects = tmpproject;
      },
      err => this.remove_from_project_error_msg = err.error
    )
  }

  delete() {
    this.userService.delete(this.user.uid).subscribe(
      resp => {
        this.router.navigate(['/admin/user']);
      },
      err => console.log('failed to delete user')
    )
  }

  ngOnDestroy() {
    this.dtTrigger.unsubscribe();
    this.sub.unsubscribe();
  }


}
