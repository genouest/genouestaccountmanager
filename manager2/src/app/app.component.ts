import { Component } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { AuthService } from './auth/auth.service';
import { Subscription } from 'rxjs';
import { ConfigService } from './config.service'
import { UserService } from './user/user.service';
import { PluginService } from './plugin/plugin.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent {
    title = 'Account Manager';
    user = null;
    isLogged: boolean = false;
    usages: any = []
    plugins: any = []
    config: any

    private loginSubscription: Subscription;

    ngOnInit() {
        this.plugins = [];
        this.configService.config.subscribe(
            resp => {
                this.config = resp;
                this.titleService.setTitle(this.config.name + ' ' + this.title);
            },
            err => console.log('failed to get config')
        )

    }

    ngAfterViewInit() {
        this.loginSubscription = this.authService.$authStatus.subscribe((authenticated: boolean) => {
            setTimeout(() => {
                this.user = this.authService.userProfile;
                this.isLogged = authenticated;
            })
            if(authenticated) {
                this.userService.getUsages().subscribe(
                    resp => {
                        this.usages = resp['usages'];
                    },
                    err => console.log('failed to get usages')
                )
                this.pluginService.list().subscribe(
                    resp => {
                        for(let i=0;i<resp.length;i++){
                            if(resp[i]['admin']){
                                this.plugins.push(resp[i]);
                            }
                        }
                    },
                    err => console.log('failed to get plugins')
                )
            }
        })
    }

    ngOnDestroy() {
        if (this.loginSubscription) {
            this.loginSubscription.unsubscribe();
        }
    }

    constructor(
        private titleService: Title,
        private authService: AuthService,
        private userService: UserService,
        private configService: ConfigService,
        private pluginService: PluginService

    ) {
        this.user = {
            is_admin: false
        }
        this.authService.autoLog();
        this.config = {"name": "My"};
    }

}
