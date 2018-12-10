import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-my-delete-confirm',
  templateUrl: './my-delete-confirm.component.html',
  styleUrls: ['./my-delete-confirm.component.css']
})
export class MyDeleteConfirmComponent implements OnInit {

  isDeleting: boolean

  @Input()
  onConfirm: any

  @Input()
  data: any

  constructor() { }

  ngOnInit() {
  }

  startDelete(){
    this.isDeleting = true;
  }
  cancel() {
    this.isDeleting = false;
  }
  confirm() {
    console.log('app-my-delete-confirm', this.onConfirm, this.data);

    this.onConfirm(this.data);
  }

}
