import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PluginService } from 'src/app/plugin/plugin.service';
import { AuthService } from 'src/app/auth/auth.service';

@Component({
    selector: 'app-adminplugin',
    templateUrl: './adminplugin.component.html',
    styleUrls: ['./adminplugin.component.css']
})
export class AdminpluginComponent implements OnInit {

    pluginId: string
    user: any

    constructor(
        private route: ActivatedRoute,
        private authService: AuthService,
        private pluginService: PluginService
    ) { }

    ngOnInit() {
        this.user = this.authService.profile;
        this.route.params
            .subscribe(params => {
                this.pluginId = params.id;
                console.log('manage plugin',this.pluginId);
                /*
                  this.pluginService.get(pluginId, this.authService.profile.uid).subscribe(
                  resp => console.log(resp),
                  err => console.log('failed to get plugin data')
                  )
                */
            });
    }

}
