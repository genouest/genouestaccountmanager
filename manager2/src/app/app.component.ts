import { Component } from '@angular/core';
import { AuthService } from './auth/auth.service';
import { Subscription, Observable } from 'rxjs';
import { UserService } from './user/user.service';
import { PluginService } from './plugin/plugin.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'My account manager';
  user = null;
  isLogged: boolean = false;
  usages: any = []
  plugins: any = []

  private loginSubscription: Subscription;

  ngOnInit() {
    this.plugins = [];
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
              if(resp[i].name.startsWith('admin')){
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
    private authService: AuthService,
    private userService: UserService,
    private pluginService: PluginService
  ) {
    this.user = {
      is_admin: false
    }
    this.authService.autoLog();
  }

}
