import { Component, OnInit, ViewChild } from '@angular/core';
import { Database, DatabaseService } from 'src/app/user/database.service';
import { AuthService } from 'src/app/auth/auth.service';
import { User, UserService } from 'src/app/user/user.service';
import { NgForm } from '@angular/forms';
import { Table } from 'primeng/table';


@Component({
  selector: 'app-database',
  templateUrl: './database.component.html',
  styleUrls: ['./database.component.css']
})
export class DatabaseComponent implements OnInit {
  @ViewChild('dtp') table: Table;

  session_user: User

  db: Database
  db_expire_string: string
  databases: Database[]

  users: User[]

  msg: string
  err_msg: string
  form_msg: string
  form_err_msg: string

  constructor(private databaseService: DatabaseService,
              private userService: UserService,
              private authService: AuthService,
  ) { }


  ngAfterViewInit(): void { }


  ngOnDestroy(): void { }


  ngOnInit() {
    this.db_delete = this.db_delete.bind(this);
    this.session_user = this.authService.profile;
    this.db = new Database('', 'mysql', '', '', true, "", "", 0, true);
    this.databases = [];
    this.db_list();
    // this.userService.list().subscribe(
    //     resp => this.users = resp,
    //     err => console.log('failed to get users')
    // )
  }
  
  
  db_list() {
    this.databaseService.listOwner(this.session_user.uid).subscribe(
      resp => { this.databases = resp; },
      err => { console.log('failed to get databases'); }
    );
  }


  db_ask(form: NgForm) {
    this.form_msg = '';
    this.form_err_msg = '';
    if (form.valid) {
      if (!this.db.name.match(/^[0-9a-z_]+$/)) {
        this.form_err_msg = "Database name must be alphanumeric [0-9a-z_]";
        return;
      }
      if (this.db.name.length < 5 || this.db.name.length > 42) {
        this.form_err_msg = "Database name must be between 5 and 42 characters";
        return;
      }
      this.db.expire = new Date(this.db_expire_string).getTime();
      if (this.db.expire == 0) {
        this.form_err_msg = "Database must have an expiration date";
        return;
      }
      if (this.db.expire <= new Date().getTime()) {
        this.form_err_msg = "Database expiration must be in the future";
        return;
      }
      this.databaseService.ask(this.db).subscribe(
        resp => {
          this.form_msg = resp['message'];
          this.db_list();
        },
        err => {
          this.form_err_msg = err.error.message;
          console.log('failed to add database');
        }
      );
    } else { form.control.markAllAsTouched(); }
  }


  db_delete(dbName: string) {
    this.msg = '';
    this.err_msg = '';
    this.databases.forEach((ws) => {
      if(ws.name == dbName) {
        this.databaseService.remove(ws).subscribe(
          resp => {
            this.msg = resp['message'];
            this.db_list();
          },
          err => {
            this.err_msg = err.error.message;
            console.log('failed to delete database');
          }
        );
      }
    });
  }


  print(dbName: string) {
    console.log(dbName);
  }
}
