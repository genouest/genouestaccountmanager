import { Component, OnInit, Input, ViewChildren, QueryList } from '@angular/core';
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

    dateConvert(tsp){
        var a = new Date(tsp);
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var year = a.getFullYear();
        var month = months[a.getMonth()];
        var date = a.getDate();
        var hour = a.getHours();
        var min = a.getMinutes();
        var sec = a.getSeconds();
        var time = date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
        return time;
    }
}
