import { Component, OnInit } from '@angular/core';
import { ConfigService } from 'src/app/config.service';

@Component({
    selector: 'app-registered',
    templateUrl: './registered.component.html',
    styleUrls: ['./registered.component.css']
})
export class RegisteredComponent implements OnInit {

    config: any

    constructor(private configService: ConfigService) { }

    ngOnInit() {
        this.configService.config.subscribe(
            resp => this.config = resp,
            err => console.log('failed to get config')
        )
    }

}
