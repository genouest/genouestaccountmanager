import { Component, ComponentFactoryResolver, Input, OnInit, OnChanges, ViewChild, SimpleChanges } from '@angular/core';
import { Directive, Type, ViewContainerRef } from '@angular/core';
import { BasePluginComponent } from './base-plugin/base-plugin.component';



@Component({
    template: `
<div *ngIf="data">
<div><input [ngModelOptions]="{standalone: true}" [(ngModel)]="data.newlist"/></div>
<div style="margin-top: 10px;"><button (click)="sendData()" type="button"  class="btn btn-default">Create</button></div>
</div>
<div *ngIf="data" class="table-responsive">
<table class="table table-striped ng-scope">
<tr><th>List</th></tr>
<tr *ngFor="let list of data.lists">
<td>{{list.list_name}}</td>
</tr>
</table>
</div>
`,
})
export class GomailPluginComponent extends BasePluginComponent implements OnInit {
    ngOnInit() {
        this.pluginName = "gomail";
        this.loadData(this.userId);
    }
}

@Component({
    template: `
<div *ngIf="data">
<div *ngIf="loading">Loading...</div>
<div class="alert alert-info">Using this button, you can set your home and groups in <a href=\"http:\/\/data-access.cesgo.org\/\" target
= "blank" >data-access </a> for easy access</div>

<div style="text-align:center;"><button (click)="sendData()" type="button"  class="btn btn-primary">Update</button></div><br>
<div *ngIf="data.api_status" class ="alert alert-danger">{{data.api_status}}</div>
<div *ngIf="data.user_status" class ="alert alert-danger">{{data.user_status}}</div>
<div *ngIf="data.my" class ="alert alert-success">{{data.my}}</div>
<div>Current registered shares :</div><br>
<table style ="width:100%;" class="table table-striped"><tr><th>Path</th><th>Host</th></tr>
<tr *ngFor="let share of data.user_shares">
<td>{{share.path}}</td><td>{{share.host}}</td>
</tr>
</table>
</div>
`,
})
export class DataAccessPluginComponent extends BasePluginComponent implements OnInit {
    ngOnInit() {
        this.pluginName = "data_access";
        this.loadData(this.userId);
    }
}

@Component({
    template: `
<div>
</div>
`,
})
export class GalaxyPluginComponent extends BasePluginComponent implements OnInit {
    ngOnInit() {
        this.pluginName = "galaxy";
        this.loadData(this.userId);
    }
}

@Component({
    template: `
<div *ngIf="data">
<div *ngIf="loading">Loading...</div>
<div *ngIf="data.api_status" class ="alert alert-danger">{{data.api_status}}</div>
<div *ngIf="data.has_project == 'False'" style="text-align:center;"><button (click)="sendData()" type="button" class="btn btn-primary">Activate cloud account</button></div>
<div *ngIf="data.my" class ="alert alert-success">{{data.my}}</div>
<div *ngIf="data.has_project == 'True'">
  <div>Current project(s) :</div><br>
  <table style ="width:100%;" class="table table-striped">
    <tr *ngFor="let project of data.projects">
      <td>{{project.name}}</td>
    </tr>
  </table>
</div>
</div>
`,
})
export class GenostackPluginComponent extends BasePluginComponent implements OnInit {
    ngOnInit() {
        this.pluginName = "genostack";
        this.loadData(this.userId);
    }
}

@Component({
    template: `
<div>
<div>Populate_home will create a project_demo folder upon user activation.</div>
</div>
`,
})
export class PopulateHomePluginComponent extends BasePluginComponent implements OnInit {
    ngOnInit() {
        this.pluginName = "populate_home";
        this.loadData(this.userId);
    }
}

@Component({
    template: `
<div class="table-responsive">
<div *ngIf="loading">Loading...</div>
<table *ngIf="data" class="table table-striped ng-scope">
<tr><th>Namespace</th><th>Used</th><th>Max</th></tr>
<tr [ngClass]="(data.error || data.warning) ? 'label label-warning': ''" *ngFor="let quota of data.quotas">
<td>{{quota.name}}</td>
<td>{{quota.value | number: '1.0-2'}} G</td>
<td>{{quota.max | number: '1.0-2'}} G</td>
</tr>
</table>
</div>
`,
})
export class QuotasPluginComponent extends BasePluginComponent implements OnInit {
    ngOnInit() {
        this.pluginName = "quota";
        this.loadData(this.userId);
    }
}


@Component({
    template: `
<div>
<div *ngIf="data && data.alert" class="alert alert-warning">
<strong>Warning!</strong> {{data.alert}}
</div>
<div *ngIf="data">
<p>hello {{data.my}}</p>
<button (click)="sendData()">Test me</button>
</div>
</div>
`,
})
export class TestPluginComponent extends BasePluginComponent implements OnInit {
    ngOnInit() {
        this.pluginName = "test";
        this.loadData(this.userId);
    }
}

@Component({
    template: `
<div *ngIf="data">
<div *ngIf="loading">Loading...</div>
<div *ngIf="data.alert" class="alert alert-warning">
<strong>Warning!</strong> {{data.alert}}
</div>
<div class="row">
<div class="col-md-6">

<table class="table table-striped">
<thead><tr><td>User</td><td>Quota</td><td>Expire</td></tr></thead>
<tbody>
<tr *ngFor="let l of data.list">
<td (click)="setData('selected', l)">{{l.id}}</td><td><div *ngFor="let q of l.quota">{{q.id}}:{{q.value}}</div></td><td>{{l.expire}}</td>
</tr>
</tbody>
</table>

</div>
<div class="col-md-6">

<form *ngIf="data.selected">
<div class="form-group">
<label>User</label>
<input readonly class="form-control" type="text" [ngModelOptions]="{standalone: true}" [(ngModel)]="data.selected.id"/>
</div>
<div class="form-group" *ngFor="let q of data.selected.quota">
<label>{{q.id}} quota (GB)</label>
<input class="form-control" type="number" [ngModelOptions]="{standalone: true}" [(ngModel)]="q.value"/>
</div>
<div class="form-group">
<label>Expiration</label>
<input class="form-control" type="date" [ngModelOptions]="{standalone: true}" [(ngModel)]="data.selected.expire"/>
</div>
</form>
<button *ngIf="data.selected" (click)="sendData()">Update</button>
</div>
</div>
</div>
`,
})
export class AdminQuotaExamplePluginComponent extends BasePluginComponent implements OnInit {

    ngOnInit() {
        this.pluginName = "adminquotatest";
        console.log('load plugin for user', this.userId)
        this.loadData(this.userId);
    }

}




@Directive({
    selector: '[app-plugin-view]',
})
export class PluginDirective {
    constructor(public viewContainerRef: ViewContainerRef) { }
}


export class PluginItem {
    constructor(public name: string, public component: Type<any>, public data: any, public userId: string) {}
}

export class PluginItems {
    static items: PluginItem[] = [
        new PluginItem("test", TestPluginComponent, null, null),
        new PluginItem("galaxy", GalaxyPluginComponent, null, null),
        new PluginItem("genostack", GenostackPluginComponent, null, null),
        new PluginItem("populate_home", PopulateHomePluginComponent, null, null),
        new PluginItem("data_access", DataAccessPluginComponent, null, null),
        new PluginItem("quota", QuotasPluginComponent, null, null),
        new PluginItem("gomail", GomailPluginComponent, null, null),
        new PluginItem("adminquotatest", AdminQuotaExamplePluginComponent, null, null)
    ];
    constructor() {
    }

    static add(pluginName: string) {
        if (PluginItems.items === undefined) {
            PluginItems.items = [];
        }
        if (pluginName == "test") {
            PluginItems.items.push(new PluginItem(pluginName, TestPluginComponent, null, null));
        } else if (pluginName == "galaxy") {
            PluginItems.items.push(new PluginItem(pluginName, GalaxyPluginComponent, null, null));
        } else if (pluginName == "genostack") {
            PluginItems.items.push(new PluginItem(pluginName, GenostackPluginComponent, null, null));
        } else if (pluginName == "populate_home") {
            PluginItems.items.push(new PluginItem(pluginName, PopulateHomePluginComponent, null, null));
        } else if (pluginName == "data_access") {
            PluginItems.items.push(new PluginItem(pluginName, DataAccessPluginComponent, null, null));
        } else if (pluginName == "quota") {
            PluginItems.items.push(new PluginItem(pluginName, QuotasPluginComponent, null, null));
        } else if (pluginName == "gomail") {
            PluginItems.items.push(new PluginItem(pluginName, GomailPluginComponent, null, null));
        }
    }

    static getItem(pluginName: string): PluginItem {
        for(let i=0;i<PluginItems.items.length; i++) {
            let item = PluginItems.items[i];
            if (item.name === pluginName) {
                return item;
            }
        }
        return null;
    }
}





@Component({
    selector: 'app-plugin',
    templateUrl: './plugin.component.html',
    styleUrls: ['./plugin.component.css']
})
export class PluginComponent implements OnInit, OnChanges {
    @Input() pluginItem: string
    @Input() userId: string
    @ViewChild(PluginDirective, {static: true}) appPlugin: PluginDirective;
    constructor(private componentFactoryResolver: ComponentFactoryResolver) { }

    ngOnInit() {
        // should load component from its name (pluginItem should be plugin name, a string)
        let pItem = PluginItems.getItem(this.pluginItem);
        if (!pItem) {
            return;
        }

        // pItem.userId = this.userId;
        let componentFactory = this.componentFactoryResolver.resolveComponentFactory(pItem.component);

        let viewContainerRef = this.appPlugin.viewContainerRef;
        viewContainerRef.clear();

        let componentRef = viewContainerRef.createComponent(componentFactory);
        (<BasePluginComponent>componentRef.instance).userId = this.userId;
        //(<BasePluginComponent>componentRef.instance).loadData(this.userId);
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.userId && changes.userId.currentValue !== changes.userId.previousValue) {
            let pItem = PluginItems.getItem(this.pluginItem);
            if (!pItem) {
                return;
            }

            // pItem.userId = this.userId;
            let componentFactory = this.componentFactoryResolver.resolveComponentFactory(pItem.component);

            let viewContainerRef = this.appPlugin.viewContainerRef;
            viewContainerRef.clear();

            let componentRef = viewContainerRef.createComponent(componentFactory);
            (<BasePluginComponent>componentRef.instance).userId =  changes.userId.currentValue;
        }
    }

}
