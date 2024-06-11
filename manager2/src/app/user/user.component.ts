import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { UserService } from './user.service'
import { AuthService } from '../auth/auth.service'
import { ConfigService } from '../config.service'
import { Website, WebsiteService } from './website.service'
import { PluginService} from '../plugin/plugin.service'
import { GroupsService } from '../admin/groups/groups.service'
import { ProjectsService } from '../admin/projects/projects.service'

import { ActivatedRoute, Router } from '@angular/router';
import { WindowWrapper } from '../windowWrapper.module';
import { FlashMessagesService } from '../utils/flash/flash.component';

import { 
    solveRegistrationChallenge
} from '@webauthn/client';

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
    selector: 'app-user-extra',
    templateUrl: './user-extra.component.html',
    styleUrls: ['./user-extra.component.css']
})
export class UserExtraComponent implements OnInit {
    @Input() user: any
    @Output() extraValues = new EventEmitter<any>();
    config: any
    //@ViewChild('extras') extras: any
    extras: any

    constructor(
        private configService: ConfigService,
    ) {
        this.config = {}
        this.extras = []
    }

    ngOnInit() {
        this.extraChange = this.extraChange.bind(this);
        this.configService.config.subscribe(
            resp => {
                this.config = resp;
                let extras =resp.registration || [];
                let user_extras = {};
                if (this.user && this.user.extra_info) {
                    for(let i=0;i<this.user.extra_info.length;i++) {
                        let extra_info = this.user.extra_info[i];
                        user_extras[extra_info.title] = extra_info.value;
                    }
                }
                for(let i=0;i<extras.length;i++) {
                    extras[i].value = extras[i].choices[0][0];
                    if (extras[i].multiple) {
                        extras[i].value = [extras[i].choices[0][0]];
                    }
                    if(user_extras[extras[i].title]) {
                        extras[i].value = user_extras[extras[i].title];
                    }
                }
                this.extras = extras;
                console.log('extras', this.extras);
            },
            err => console.log('failed to get config')
        )
    }


    extraChange(title, data) {
        console.debug('event', data.target.checked, data.target.value)
        for(let i=0;i<this.extras.length;i++) {
            let extra = this.extras[i];
            if(extra.title == title) {
                if(extra.multiple) {
                    let cur_values = [...extra.value];
                    let index = cur_values.indexOf(data.target.value);
                    if(data.target.checked) {
                        // add
                        if (index < 0) {
                            cur_values.push(data.target.value);
                        }
                    } else {
                        // remove
                        if (index >= 0) {
                            cur_values.splice(index, 1)
                        }
                    }
                    this.extras[i].value = cur_values;
                } else {
                    extra.value = data.target.value;
                }
                break;
            }
        }

        console.debug('extras changed', title, this.extras);
        this.extraValues.emit(this.extras);
    }
}


@Component({
    selector: 'app-user',
    templateUrl: './user.component.html',
    styleUrls: ['./user.component.css']
})
export class UserComponent implements OnInit {

    user_projects: any[]
    new_projects: any[]
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
    note: string
    err_note: string

    STATUS_PENDING_EMAIL = 'Waiting for email approval'
    STATUS_PENDING_APPROVAL = 'Waiting for admin approval'
    STATUS_ACTIVE = 'Active'
    STATUS_EXPIRED = 'Expired'

    private sub: any

    website: Website
    websites: Website[]

    plugins: any[]
    plugin_data: any

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

    notify_subject: string
    notify_message: string
    notify_err: string
f
    key_err: string

    otp: string

    constructor(
        private route: ActivatedRoute,
        private userService: UserService,
        private authService: AuthService,
        private configService: ConfigService,
        private websiteService: WebsiteService,
        private pluginService: PluginService,
        private groupService: GroupsService,
        private projectService: ProjectsService,
        private router: Router,
        private window: WindowWrapper,
        private _flashMessagesService: FlashMessagesService
    ) {
        this.projects = []
        this.user_projects = []
        this.new_projects = []
        this.session_user = this.authService.profile
        this.user = {}
        this.config = {}
        this.website = new Website('', '', '', '')
        this.websites = []
        this.plugins = []
        this.plugin_data = {}
        this.subscribed = false
        this.groups = []
        this.note = ''
        this.err_note = ''
        this.password1  = ''
        this.password2 = ''

        this.notify_subject = ''
        this.notify_message = ''
        this.notify_err = ''
        this.key_err = ''
        this.otp = null

    }

    date_convert = function timeConverter(tsp){
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

    onExtraValue(extras: any) {
        console.debug('extras updated', extras);
        let new_extra = [];
        for(let i=0;i<extras.length;i++){
            let extra = extras[i];
            new_extra.push({'title': extra.title, 'value': extra.value})
        }
        this.user.extra_info = new_extra;
    }

    initUser = function() {
        this.sub = this.route.params.subscribe(params => {
            this.pluginService.list().subscribe(
                resp => {
                    let plugins = [];
                    for(let i=0;i < resp.length; i++){
                        if(! resp[i]['admin']) {
                            plugins.push(resp[i]);
                        }
                    }
                    this.plugins = plugins;
                },
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

            this.userService.isSubscribed(params['id']).subscribe(
                resp =>{
                    this.subscribed = resp['subscribed']
                },
                err => {console.log('subscribedError',err);}
            )
        });
    }

    ngOnInit() {
        this.onExtraValue = this.onExtraValue.bind(this);
        this.web_delete = this.web_delete.bind(this);
        this.delete_secondary_group = this.delete_secondary_group.bind(this);
        this.delete = this.delete.bind(this);
        this.subscribe = this.subscribe.bind(this);
        this.unsubscribe = this.unsubscribe.bind(this);
        this.initUser = this.initUser.bind(this);
        this.sendmail = this.sendmail.bind(this);

        this.configService.config.subscribe(
            resp => {
                this.config = resp;
                this.initUser();
            },
            err => console.log('failed to get config')
        )


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
        let new_projects = [];
        for(let i=0; i<projects.length;i++){
            if(this.user.projects == null){ this.user.projects = []; }
            if (this.user.projects.indexOf(projects[i].id) >= 0){
                let is_owner = false;
                let user_in_group = false;
                if(this.user.uid === projects[i].owner){
                    is_owner = true;
                }
                if(this.user.group.indexOf(projects[i].group) >= 0 || this.user.secondarygroups.indexOf(projects[i].group) >= 0){
                    user_in_group = true;
                }
                user_projects.push({id: projects[i].id, owner: is_owner, group: projects[i].group, member: user_in_group});
            } else {
                new_projects.push({id: projects[i].id, owner: false, group: projects[i].group, member: false});
            }
        }
        user_projects.sort(this._compareId)
        new_projects.sort(this._compareId)
        this.user_projects = user_projects;
        this.new_projects = new_projects;
    }

    add_note() {
        let head_note = `[note by ${this.session_user.uid}]`;
        this.userService.add_note(this.user.uid, head_note + this.note).subscribe(
            resp => {
                this.note = '';
                this.err_note = '';
            },
            err => {
                this.err_note = 'failed to add note';
            }
        );
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

        this.user.secondarygroups.sort(function (a,b) {
            return a.localeCompare(b);
        });
    }


    subscribe() {
        let ctx = this;
        this.userService.subscribe(this.user.uid).subscribe(
            resp => {
                if (resp['subscribed']) {
                    ctx.subscribed = true;
                } else {
                    ctx.err_msg = "Failed to subscribe"
                }
            },
            err => console.log('failed to subscribe')
        )
    }

    unsubscribe() {
        let ctx = this;
        this.userService.unsubscribe(this.user.uid).subscribe(
            resp => {
                if (resp['unsubscribed']) {
                    ctx.subscribed = false;
                } else {
                    ctx.err_msg = "Failed to unsubscribe"
                }
            },
            err => console.log('failed to unsubscribe')
        )
    }

    web_list() {
        this.websiteService.listOwner(this.user.uid).subscribe(
            resp => this.websites = resp,
            err => console.log('failed to get web sites')
        )
    }

    get_key(user_id:string, key:string) {
        //['/ssh', {id: user.uid}, 'private']
        console.log("get key " + key + " for " + user_id)
        this.userService.getSSHKey(user_id, key).subscribe(
            resp => {
                this.key_err = '';
                console.log("key = ", resp)
                let keyName = "id_rsa.pub"
                if(key == "private") {
                    keyName = "id_rsa"
                } else if (key == "putty") {
                    keyName = "id_rsa.ppk"
                }
                let blob = new Blob([resp], {type: 'application/octet-stream'});

                // IE doesn't allow using a blob object directly as link href
                // instead it is necessary to use msSaveOrOpenBlob
                if (window.navigator && window.navigator.msSaveOrOpenBlob) {
                    window.navigator.msSaveOrOpenBlob(blob);
                    return;
                }

                // For other browsers:
                // Create a link pointing to the ObjectURL containing the blob.
                const downloadURL = URL.createObjectURL(blob);
                //window.open(downloadURL);

                var a = document.createElement("a");
                if ( a.download != undefined ) {
                    document.body.appendChild(a);
                    a.href = downloadURL;
                    a.download = keyName;
                    a.click();
                    setTimeout(function() {
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(downloadURL);
                    }, 100);
                }
            },
            err => {
                console.log("failed to get ssh key", err);
                this.key_err = err.error;
            }
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
            err => { this.webmsg = err.error.message; console.log('failed to add web site')}
        )
    }
    web_delete(siteName: string) {
        this.websites.forEach((ws)=>{
            if(ws.name == siteName) {
                this.websiteService.remove(ws).subscribe(
                    resp => { this.rmwebmsg = ''; this.web_list()},
                    err  => { this.rmwebmsg = err.error.message; console.log('failed to delete web site', err)}
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
                this.user.expiration = resp['expiration'];
                this._flashMessagesService.show('Your account validity period has been extended', { cssClass: 'alert-success', timeout: 5000 });


            },
            err => {
                console.log('failed to extend user', err)
            }
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
        this.panel = panel;
    }

    sendmail() {
        console.log('should send mail', {subject: this.notify_subject, msg: this.notify_message});
        this.userService.notify(this.user.uid,
            {
                subject: this.notify_subject,
                message: this.notify_message
            }).subscribe(
                resp => {
                    this.notify_subject = ''
                    this.notify_message = ''
                    this.notify_err = ''
                    this.msg = 'mail sent'
                },
                err => {
                    this.notify_err = 'failed to send email'
                    console.log(('failed to send mail'))
                }
            )
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
            resp => this.new_key_message = resp['message'],
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
            err => this.update_error_msg = err.error.message
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
                this.ssh_message = 'Failed to set key';
                console.log('failed to update ssh key', err)
            }
        )
    }

    activate() {
        this.err_msg = '';
        this.msg = '';
        this.userService.activate(this.user.uid).subscribe(
            resp => {
                this.user.status = this.STATUS_ACTIVE;
                this.msg = resp['message']
            },
            err => this.err_msg = err.error.message
        )
    }

    register_u2f() {

        this.userService.u2fGet(this.user.uid).subscribe( 
            resp => {
                let challenge = resp;
                let ctx =this;
                this.u2f = "Please insert your key and press button";
                solveRegistrationChallenge(challenge).then((credentials) => {
                    this.userService.u2fSet(this.user.uid, credentials).subscribe( () => {
                        ctx.u2f = null;
                        ctx.user.u2f = {'challenge': challenge};
                    })
                }).catch(err => { console.error(err); ctx.u2f = "registration error"});
            },
            err => console.log('failed to get u2f devices')
        )
    }

    register_otp() {
        this.userService.otpRegister(this.user.uid).subscribe(
            resp => {
                this.otp = resp['imageUrl'];
            },
            err => {
                console.error(err)
            }
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
                    this.user_projects.push({id: newproject.id, owner: false, member: true})
                },
                err => this.add_to_project_error_msg = err.error.message
            )
        }

    }

    remove_from_project(project_id) {
        this.userService.removeFromProject(this.user.uid, project_id).subscribe(
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
            err => this.remove_from_project_error_msg = err.error.message
        )
    }

    delete(message: string, sendmail: boolean) {
        // console.log(this.user.uid, message);
        this.userService.delete(this.user.uid, message, sendmail).subscribe(
            resp => {
                this._flashMessagesService.show(resp['message'], { cssClass: 'alert-success', timeout: 5000 });
                this.router.navigate(['/admin/user']);
            },
            err => {
                this.err_msg = err.error.message;
                console.log('failed to delete user', err);
            }
        )
    }

    ngOnDestroy() {
        if(this.sub) {
            this.sub.unsubscribe();
        }
    }


}
