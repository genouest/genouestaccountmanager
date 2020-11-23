import { Component, Input } from '@angular/core';
import { PluginService } from '../plugin.service';

@Component({
    template: '<div></div>',
    styleUrls: ['./base-plugin.component.css']
})
export class BasePluginComponent {
    @Input() userId: string;
    pluginName: string;
    data: any;
    loading: boolean;

    constructor(private pluginService: PluginService) {}

    ngOnDestroy(): void {
    }
    ngAfterViewInit(): void {
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

    date_convert = function timeConverter(tsp){
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
