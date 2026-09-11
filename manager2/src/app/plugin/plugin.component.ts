import { Component, Input, OnInit, OnChanges, ViewChild, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { Directive, Type, ViewContainerRef } from '@angular/core';
import { BasePluginComponent } from './base-plugin/base-plugin.component';

@Component({
    template: `
        @if (data) {
          <div>
            <div><input [ngModelOptions]="{ standalone: true }" [(ngModel)]="data.newlist" /></div>
            <div style="margin-top: 10px;">
              <p-button size="small" (onClick)="sendData()" type="button" styleClass="-default" label="Create"></p-button>
            </div>
          </div>
        }
        @if (data) {
          <div class="table-responsive">
            <table class="table table-striped ng-scope">
              <tr>
                <th>List</th>
              </tr>
              @for (list of data.lists; track list) {
                <tr>
                  <td>{{ list.list_name }}</td>
                </tr>
              }
            </table>
          </div>
        }
        `,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class GomailPluginComponent extends BasePluginComponent implements OnInit {
    ngOnInit() {
        this.pluginName = 'gomail';
        this.loadData(this.userId);
    }
}

@Component({
    template: `
        @if (data) {
          <div>
            @if (loading) {
              <div>Loading...</div>
            }
            <div class="alert alert-info">
              Using this button, you can set your home and groups in
              <a href="http://data-access.cesgo.org/" target="blank">data-access </a> for easy access
            </div>
            <div style="text-align:center;">
              <p-button severity="primary" size="small" (onClick)="sendData()" type="button" label="Update"></p-button>
            </div>
            <br />
            @if (data.api_status) {
              <div class="alert alert-danger">{{ data.api_status }}</div>
            }
            @if (data.user_status) {
              <div class="alert alert-danger">{{ data.user_status }}</div>
            }
            @if (data.my) {
              <div class="alert alert-success">{{ data.my }}</div>
            }
            <div>Current registered shares :</div>
            <br />
            <table style="width:100%;" class="table table-striped">
              <tr>
                <th>Path</th>
                <th>Host</th>
              </tr>
              @for (share of data.user_shares; track share) {
                <tr>
                  <td>{{ share.path }}</td>
                  <td>{{ share.host }}</td>
                </tr>
              }
            </table>
          </div>
        }
        `,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class DataAccessPluginComponent extends BasePluginComponent implements OnInit {
    ngOnInit() {
        this.pluginName = 'data_access';
        this.loadData(this.userId);
    }
}

@Component({
    template: ` <div></div> `,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class GalaxyPluginComponent extends BasePluginComponent implements OnInit {
    ngOnInit() {
        this.pluginName = 'galaxy';
        this.loadData(this.userId);
    }
}

@Component({
    template: `
        @if (data) {
          <div>
            @if (loading) {
              <div>Loading...</div>
            }
            @if (data.api_status) {
              <div class="alert alert-danger">{{ data.api_status }}</div>
            }
            @if (data.has_project == 'False') {
              <div style="text-align:center;">
                <p-button severity="primary" size="small" (onClick)="sendData()" type="button" >
                  Activate cloud account
                </p-button>
              </div>
            }
            @if (data.my) {
              <div class="alert alert-success">{{ data.my }}</div>
            }
            @if (data.has_project == 'True') {
              <div>
                <div>Current project(s) :</div>
                <br />
                <table style="width:100%;" class="table table-striped">
                  @for (project of data.projects; track project) {
                    <tr>
                      <td>{{ project.name }}</td>
                    </tr>
                  }
                </table>
              </div>
            }
          </div>
        }
        `,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class GenostackPluginComponent extends BasePluginComponent implements OnInit {
    ngOnInit() {
        this.pluginName = 'genostack';
        this.loadData(this.userId);
    }
}

@Component({
    template: `
        <div>
            <div>Populate_home will create a project_demo folder upon user activation.</div>
        </div>
    `,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PopulateHomePluginComponent extends BasePluginComponent implements OnInit {
    ngOnInit() {
        this.pluginName = 'populate_home';
        this.loadData(this.userId);
    }
}

@Component({
    template: `
        <div class="table-responsive">
          @if (loading) {
            <div>Loading...</div>
          }
          @if (data) {
            <table class="table table-striped ng-scope">
              <tr>
                <th>Namespace</th>
                <th>Used</th>
                <th>Max</th>
              </tr>
              @for (quota of data.quotas; track quota) {
                <tr
                  [ngClass]="data.error || data.warning ? 'label label-warning' : ''"
                  >
                  <td>{{ quota.name }}</td>
                  <td>{{ quota.value | number : '1.0-2' }} G</td>
                  <td>{{ quota.max | number : '1.0-2' }} G</td>
                </tr>
              }
            </table>
          }
        </div>
        `,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class QuotasPluginComponent extends BasePluginComponent implements OnInit {
    ngOnInit() {
        this.pluginName = 'quota';
        this.loadData(this.userId);
    }
}

@Component({
    template: `
        <div>
          @if (data && data.alert) {
            <div class="alert alert-warning"><strong>Warning!</strong> {{ data.alert }}</div>
          }
          @if (data) {
            <div>
              <p>hello {{ data.my }}</p>
              <p-button (onClick)="sendData()" label="Test me"></p-button>
            </div>
          }
        </div>
        `,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TestPluginComponent extends BasePluginComponent implements OnInit {
    ngOnInit() {
        this.pluginName = 'test';
        this.loadData(this.userId);
    }
}

@Component({
    template: `
        @if (data) {
          <div>
            @if (loading) {
              <div>Loading...</div>
            }
            @if (data.alert) {
              <div class="alert alert-warning"><strong>Warning!</strong> {{ data.alert }}</div>
            }
            <div class="row">
              <div class="col-md-6">
                <table class="table table-striped">
                  <thead>
                    <tr>
                      <td>User</td>
                      <td>Quota</td>
                      <td>Expire</td>
                    </tr>
                  </thead>
                  <tbody>
                    @for (l of data.list; track l) {
                      <tr>
                        <td (click)="setData('selected', l)">{{ l.id }}</td>
                        <td>
                          @for (q of l.quota; track q) {
                            <div>{{ q.id }}:{{ q.value }}</div>
                          }
                        </td>
                        <td>{{ l.expire }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <div class="col-md-6">
                @if (data.selected) {
                  <form>
                    <div class="form-group">
                      <label>User</label>
                      <input
                        readonly
                        class="form-control"
                        type="text"
                        [ngModelOptions]="{ standalone: true }"
                        [(ngModel)]="data.selected.id"
                        />
                    </div>
                    @for (q of data.selected.quota; track q) {
                      <div class="form-group">
                        <label>{{ q.id }} quota (GB)</label>
                        <input
                          class="form-control"
                          type="number"
                          [ngModelOptions]="{ standalone: true }"
                          [(ngModel)]="q.value"
                          />
                      </div>
                    }
                    <div class="form-group">
                      <label>Expiration</label>
                      <input
                        class="form-control"
                        type="date"
                        [ngModelOptions]="{ standalone: true }"
                        [(ngModel)]="data.selected.expire"
                        />
                    </div>
                  </form>
                }
                @if (data.selected) {
                  <p-button (onClick)="sendData()" label="Update"></p-button>
                }
              </div>
            </div>
          </div>
        }
        `,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AdminQuotaExamplePluginComponent extends BasePluginComponent implements OnInit {
    ngOnInit() {
        this.pluginName = 'adminquotatest';
        console.log('load plugin for user', this.userId);
        this.loadData(this.userId);
    }
}

@Directive({
    selector: '[app-plugin-view]',
    standalone: false
})
export class PluginDirective {
    constructor(public viewContainerRef: ViewContainerRef) {}
}

export class PluginItem {
    constructor(public name: string, public component: Type<any>, public data: any, public userId: string) {}
}

export class PluginItems {
    static items: PluginItem[] = [
        new PluginItem('test', TestPluginComponent, null, null),
        new PluginItem('galaxy', GalaxyPluginComponent, null, null),
        new PluginItem('genostack', GenostackPluginComponent, null, null),
        new PluginItem('populate_home', PopulateHomePluginComponent, null, null),
        new PluginItem('data_access', DataAccessPluginComponent, null, null),
        new PluginItem('quota', QuotasPluginComponent, null, null),
        new PluginItem('gomail', GomailPluginComponent, null, null),
        new PluginItem('adminquotatest', AdminQuotaExamplePluginComponent, null, null)
    ];
    constructor() {}

    static add(pluginName: string) {
        if (PluginItems.items === undefined) {
            PluginItems.items = [];
        }
        if (pluginName == 'test') {
            PluginItems.items.push(new PluginItem(pluginName, TestPluginComponent, null, null));
        } else if (pluginName == 'galaxy') {
            PluginItems.items.push(new PluginItem(pluginName, GalaxyPluginComponent, null, null));
        } else if (pluginName == 'genostack') {
            PluginItems.items.push(new PluginItem(pluginName, GenostackPluginComponent, null, null));
        } else if (pluginName == 'populate_home') {
            PluginItems.items.push(new PluginItem(pluginName, PopulateHomePluginComponent, null, null));
        } else if (pluginName == 'data_access') {
            PluginItems.items.push(new PluginItem(pluginName, DataAccessPluginComponent, null, null));
        } else if (pluginName == 'quota') {
            PluginItems.items.push(new PluginItem(pluginName, QuotasPluginComponent, null, null));
        } else if (pluginName == 'gomail') {
            PluginItems.items.push(new PluginItem(pluginName, GomailPluginComponent, null, null));
        }
    }

    static getItem(pluginName: string): PluginItem {
        for (let i = 0; i < PluginItems.items.length; i++) {
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
    styleUrls: ['./plugin.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PluginComponent implements OnInit, OnChanges {
    @Input() pluginItem: string;
    @Input() userId: string;
    @ViewChild('pluginContainer', { read: ViewContainerRef }) pluginContainer: ViewContainerRef;

    ngOnInit() {
        this.loadComponent();
    }

    private loadComponent() {
        let pItem = PluginItems.getItem(this.pluginItem);
        if (!pItem) {
            return;
        }

        this.pluginContainer.clear();
        
        let componentRef = this.pluginContainer.createComponent(pItem.component);
        (<BasePluginComponent>componentRef.instance).userId = this.userId;
        //(<BasePluginComponent>componentRef.instance).loadData(this.userId);
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.userId && changes.userId.currentValue !== changes.userId.previousValue) {
            let pItem = PluginItems.getItem(this.pluginItem);
            if (!pItem) {
                return;
            }

            this.pluginContainer.clear();

            let componentRef = this.pluginContainer.createComponent(pItem.component);
            (<BasePluginComponent>componentRef.instance).userId = changes.userId.currentValue;
        }
    }
}
