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
        this.configService.config.subscribe(
            resp => this.config = resp,
            err => console.log('failed to get config')
        )
        if (this.authService.isLoggedIn) {
            let user = this.authService.profile;
            this.router.navigate(['/user/' + user.uid]);
        } else {
            this.router.navigate(['/login']);
        }
    }

}
