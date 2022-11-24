import { Component, OnInit, ViewChild } from '@angular/core';
import { Database, DatabaseService } from 'src/app/user/database.service';
import { UserService } from 'src/app/user/user.service';

import { Table } from 'primeng/table';

@Component({
  selector: 'app-database',
  templateUrl: './database.component.html',
  styleUrls: ['./database.component.css']
})
export class DatabaseComponent implements OnInit {
  @ViewChild('dtp') table: Table;


  db: Database
  databases: Database[]
  users: any

  msg: string
  err_msg: string

  constructor(private dbService: DatabaseService, private userService: UserService) { }

  ngAfterViewInit(): void {
  }

  ngOnDestroy(): void {
  }

  ngOnInit(): void {
    this.db = new Database('','mysql','','', false)
        this.dbService.list().subscribe(
            resp => {this.databases = resp;},
            err => console.log('failed to get databases')
        )
        this.userService.list().subscribe(
            resp => this.users = resp,
            err => console.log('failed to get users')
        )
    }
  

}
