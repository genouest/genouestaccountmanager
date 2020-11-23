import { Component, Input, ViewChild } from '@angular/core';
import { Table } from 'primeng/table';
import { UserService } from './user.service';

@Component({
    selector: 'app-userlogs',
    templateUrl: './userlogs.component.html'
})
export class UserLogsComponent {
    @Input() user: string;
    events: any = [];

    @ViewChild('dtp') table: Table;



    constructor(private userService: UserService) {
    }

    ngOnInit() {
        console.log('load logs');
        this.load_logs();
    }

    ngOnDestroy(): void {
    }

    load_logs() {
        if (!this.user) {
            return;
        }
        this.userService.getUserLogs(this.user).subscribe(
            resp => {
                this.events=(<any[]> resp).reverse();
            },
            err => console.log('failed to get events')
        );
    }

    date_convert(tsp){
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
}
