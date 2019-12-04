import { Component, OnInit, Input, ViewChildren, QueryList } from '@angular/core';
import { PluginService } from '../plugin.service';
import { DataTableDirective } from 'angular-datatables';
import { Subject } from 'rxjs';

@Component({
    template: '<div></div>',
    styleUrls: ['./base-plugin.component.css']
})
export class BasePluginComponent {
    @Input() userId: string;
    pluginName: string;
    data: any;
    loading: boolean;

    @ViewChildren(DataTableDirective)
    tables: QueryList<DataTableDirective>;

    dtTrigger: Subject<any> = new Subject()

    constructor(private pluginService: PluginService) {}

    ngOnDestroy(): void {
        this.dtTrigger.unsubscribe();
    }
    ngAfterViewInit(): void {
        this.dtTrigger.next();
    }

    renderDataTables(): void {
        if(this.dtTrigger.isStopped) {
            console.debug('trigger is stopped');
            return;
        }
        // console.log('tables', this.tables);
        this.dtTrigger.next();
        this.tables.forEach(table => {
            // console.log('dttrigger?', table.dtTrigger)
            if (table.dtTrigger) {
                table.dtInstance.then((dt: DataTables.Api) => {
                    dt.clear();
                    dt.destroy();
                    table.dtTrigger.next();
                });
            }
        });
    }

    loadData(userId: string) {
        if (!userId) { return; }
        this.loading = true;
        this.userId = userId;
        this.pluginService.get(this.pluginName, userId)
            .subscribe(
                resp => {
                    this.loading = false;
                    this.data = resp;
                    this.renderDataTables();
                },
                err => console.log('failed to get plugin data:', err)
            );
    }
    sendData(){
        this.pluginService.set(this.pluginName, this.userId, this.data)
            .subscribe(
                resp => this.data = resp,
                err => console.log('failed to get plugin data:', err)
            );
    }

    setData(attr, value) {
        this.data[attr] = value;
    }

    date_convert(tsp){
        var a = new Date(tsp);
        return a.toLocaleString();
    }
}
