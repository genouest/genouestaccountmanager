import { Component, OnInit, ViewChild } from '@angular/core';
import { Database, DatabaseService } from 'src/app/user/database.service';
import { AuthService } from 'src/app/auth/auth.service';
import { UserService } from 'src/app/user/user.service';

import { Table } from 'primeng/table';


@Component({
  selector: 'app-database',
  templateUrl: './database.component.html',
  styleUrls: ['./database.component.css']
})
export class DatabaseComponent implements OnInit {
  @ViewChild('dtp') table: Table;

  session_user: any

  db: Database
  databases: Database[]

  users: any

  msg: string
  err_msg: string
  new_project: any
  dbmsg: string
  dbmsg_error: string
  rm_dbmsg: string
  rm_dbmsg_error: string

  constructor(private databaseService: DatabaseService,
              private userService: UserService,
              private authService: AuthService,
  ) { }

  ngAfterViewInit(): void {
  }

  ngOnDestroy(): void {
  }

  ngOnInit() {
    this.db_delete = this.db_delete.bind(this);
    this.session_user = this.authService.profile;
    this.db = new Database('','mysql','','', true, "", "", "", true)
    
    this.databases = []
    this.db_list();
    // this.userService.list().subscribe(
    //     resp => this.users = resp,
    //     err => console.log('failed to get users')
    // )
    }
  
  
    db_list() {
      this.databaseService.listOwner(this.session_user.uid).subscribe(
          resp => {this.databases = resp},
          err => console.log('failed to get databases')
      )
  }
  db_ask() {
    this.dbmsg='';
    this.dbmsg_error='';
    this.databaseService.ask(this.db).subscribe(
        resp => { this.dbmsg = resp['message']; this.db_list()},
        err => { this.dbmsg_error = err.error.message; console.log('failed to add database')}
    )
}
  

  db_delete(dbName: string) {
      this.rm_dbmsg = '';
      this.rm_dbmsg_error = '';
      this.databases.forEach((ws)=>{
          if(ws.name == dbName) {
              this.databaseService.remove(ws).subscribe(
                  resp => { this.rm_dbmsg = resp['message']; this.db_list()},
                  err => { this.rm_dbmsg_error = err.error.message; console.log('failed to delete database')}
              )
          }
      });
  }

  print(dbName: string) {
    console.log(dbName)
  }
  

}
