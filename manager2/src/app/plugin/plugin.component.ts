import { Component, ComponentFactoryResolver, Input, OnInit, OnChanges, ViewChild, SimpleChanges } from '@angular/core';
import { Directive, Type, ViewContainerRef } from '@angular/core';
import { BasePluginComponent } from './base-plugin/base-plugin.component';



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
  static items: PluginItem[] = [new PluginItem("test", TestPluginComponent, null, null)];
  constructor() {
  }
  
  static add(pluginName: string) {
    if (PluginItems.items === undefined) {
      PluginItems.items = [];
    }
    if (pluginName == "test") {
      PluginItems.items.push(new PluginItem(pluginName, TestPluginComponent, null, null));
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
