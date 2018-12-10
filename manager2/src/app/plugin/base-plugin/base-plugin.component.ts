import { Component, OnInit, Input } from '@angular/core';
import { PluginService } from '../plugin.service';

@Component({
  template: '<div></div>',
  styleUrls: ['./base-plugin.component.css']
})
export class BasePluginComponent {
  @Input() userId: string;
  pluginName: string;
  data: any;

  constructor(private pluginService: PluginService) {}
  loadData(userId: string) {
    if (!userId) { return; }
    this.userId = userId;
    this.pluginService.get(this.pluginName, userId)
    .subscribe(
      resp => this.data = resp,
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
}
