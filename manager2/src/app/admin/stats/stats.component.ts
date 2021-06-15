
import { Component, OnInit } from '@angular/core';
import { UserService } from 'src/app/user/user.service';

@Component({
    selector: 'app-stats',
    templateUrl: './stats.component.html',
    styleUrls: ['./stats.component.css']
})
export class AdminStatComponent implements OnInit {

    constructor(private userService: UserService) { }

    //users: any = []
    extras: any = {}
    domains: any = []
    status: any= []
    ngOnInit() {
        this.userService.list().subscribe(
            resp => {
                //this.users = resp;
                let extras = {};
                let mail_domain = {};
                let statuses = {}
                resp.forEach(u => {
                    if(u.extra_info) {
                        u.extra_info.forEach(extra => {
                            if(!extras[extra.title]) { extras[extra.title] = {}};
                            if (Array.isArray(extra.value)) {
                                for(let i=0;i<extra.value.length;i++) {
                                    let e = extra.value[i]
                                    if(!extras[extra.title][e]) { extras[extra.title][e] = 0;}
                                    extras[extra.title][e]++;
                                }
                            } else {
                                if(!extras[extra.title][extra.value]) { extras[extra.title][extra.value] = 0;}
                                extras[extra.title][extra.value]++;
                            }
                        });
                    }
                    if (u.email) {
                        let domain = u.email.split('@')
                        if(domain.length > 1) {
                            if(!mail_domain[domain[1]]) {mail_domain[domain[1]] = 0}
                            mail_domain[domain[1]]++;
                        }
                    }
                    if(!statuses[u.status]) {statuses[u.status] = 0}
                    statuses[u.status]++                    
                })
                let status_list = [];
                Object.keys(statuses).forEach(s => {
                    status_list.push({'title': s, 'value': statuses[s]})
                })
                this.status = status_list;

                let domain_list = []
                Object.keys(mail_domain).forEach(domain => {
                    domain_list.push({'title': domain, 'value': mail_domain[domain]})
                })
                this.domains = domain_list;
                this.extras = extras;
            },
            err => console.log('failed to get users')
        )
    }
}