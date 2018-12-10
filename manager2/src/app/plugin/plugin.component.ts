import { Component, ComponentFactoryResolver, Input, OnInit, OnChanges, ViewChild, SimpleChanges } from '@angular/core';
import { Directive, Type, ViewContainerRef } from '@angular/core';
import { BasePluginComponent } from './base-plugin/base-plugin.component';


@Component({
  template: `
  <div>
    <div class="alert alert-info">Using this button, you can set your home, omaha-beach and groups in <a href=\"http:\/\/data-access.cesgo.org\/\" target
 = "blank" >data-access </a> for easy access</div>

  <div style="text-align:center;"><button ng-click="sendData()" type="button"  class="btn tbn-default">Update</button></div><br>
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
  <div>
  <div class="alert alert-info">Plugin Genostack is active<br><br> A cloud project will be created on user activation, and deleted on user deletion.</div>
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
  <table class="table table-striped ng-scope">
  <tr><th>Namespace</th><th>Used</th><th>Max</th></tr>
  <tr *ngFor="let quota of data.quota.quotas">
  <td>{{quota.name}}</td>
  <td>{{quota.value | number: 2}} G</td>
  <td>{{quota.max | number: 2}} G</td>
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
  @ViewChild(PluginDirective) appPlugin: PluginDirective;
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
