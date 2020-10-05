import { Component, Input, ViewChildren, QueryList } from '@angular/core';
import { DataTableDirective } from 'angular-datatables';
import { Subject } from 'rxjs';
import { UserService } from './user.service';

@Component({
    selector: 'app-userlogs',
    templateUrl: './userlogs.component.html'
})
export class UserLogsComponent {
    @Input() user: string;
    events: any = [];

    @ViewChildren(DataTableDirective)
    tables: QueryList<DataTableDirective>;

    dtTrigger: Subject<any> = new Subject()
    dtOptions: DataTables.Settings = {};


    constructor(private userService: UserService) {
        this.dtOptions = {
            ordering: false
        };
    }

    ngOnInit() {
        console.log('load logs');
        this.load_logs();
    }

    ngOnDestroy(): void {
        this.dtTrigger.unsubscribe();
    }


    renderDataTables(): void {
        if(this.dtTrigger.isStopped) {
            console.debug('trigger is stopped');
            return;
        }
        this.dtTrigger.next();
    }
    load_logs() {
        if (!this.user) {
            return;
        }
        this.userService.getUserLogs(this.user).subscribe(
            resp => {
                this.events=(<any[]> resp).reverse();
                this.renderDataTables()
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
