import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { ConfigService } from '../config.service'
import { Router } from '@angular/router';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

    config: any

    constructor(private authService: AuthService,
                private configService: ConfigService,
                private router: Router) {
        this.config = {}
    }

    ngOnInit() {
        if (this.authService.isLoggedIn) {
            // Maybe we should try to use promise and async in angular too ...
            this.configService.config.subscribe(
                resp => {
                    this.config = resp;
                    if ( this.config.default_home == 'project' )
                    {
                        this.router.navigate(['/project']);
                    } else { // default to user profile page
                        let user = this.authService.profile;
                        this.router.navigate(['/user/' + user.uid]);
                    }
                },
                err => console.log('failed to get config')
            )
        } else {
            this.router.navigate(['/login']);
        }
    }

}
