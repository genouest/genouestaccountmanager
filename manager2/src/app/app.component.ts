import { Component } from '@angular/core';
import { AuthService } from './auth/auth.service';
import { Subscription } from 'rxjs';
import { UserService } from './user/user.service';

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

  private loginSubscription: Subscription;

  ngOnInit() {

  }
  ngAfterViewInit() {
    this.loginSubscription = this.authService.$authStatus.subscribe((authenticated: boolean) => {
      setTimeout(() => {
      this.isLogged = authenticated;
      this.user = this.authService.userProfile;
      })
      if(authenticated) {
        this.userService.getUsages().subscribe(
          resp => {
            this.usages = resp['usages'];
          },
          err => console.log('failed to get usages')
        )
      }
    })
  }

  ngOnDestroy() {
    if (this.loginSubscription) {
      this.loginSubscription.unsubscribe();
    }
  }

  constructor(private authService: AuthService, private userService: UserService) {
    this.user = {
      is_admin: false
    }
    this.authService.autoLog();
  }
}
