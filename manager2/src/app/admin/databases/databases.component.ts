import { Component, OnInit, ViewChild } from '@angular/core';
import { Database, DatabaseService } from 'src/app/user/database.service';
import { User, UserService } from 'src/app/user/user.service';

import { Table } from 'primeng/table';

@Component({
    selector: 'app-database',
    templateUrl: './databases.component.html',
    styleUrls: ['./databases.component.css']
})
export class DatabasesComponent implements OnInit {
    @ViewChild('dtp') table: Table;

    db: Database
    owner_db_name: Database
    owner_db_owner: User
    chowner_msg: string
    chowner_err_msg: string

    databases: Database[]
    users: User[]
    selecteddb: Database[]

    requests_visible: boolean
    pending_databases: Database[]
    pending_number: number
    
    msg: string
    err_msg: string
    dbmsg: string
    dbmsg_error: string
    

    constructor(private dbService: DatabaseService, private userService: UserService) { }


    ngAfterViewInit(): void { }


    ngOnDestroy(): void { }


    ngOnInit() {
        this.db = new Database();
        this.db_list();
        this.userService.list().subscribe(
            resp => { this.users = resp; },
            err => { console.log('failed to get users'); }
        );
        this.pending_list();
        this.selecteddb = [];
    }


    changeOwner() {
        this.chowner_msg = '';
        this.chowner_err_msg = '';
        if(!this.owner_db_name || ! this.owner_db_owner) {
            this.chowner_err_msg = 'no database or owner selected';
            return;
        }
        this.dbService.changeOwner(this.owner_db_name.name, this.owner_db_name.owner, this.owner_db_owner.uid).subscribe(
            resp => {
                this.chowner_msg = resp['message'];
                this.dbService.list().subscribe(
                    resp => { this.databases = resp; },
                    err => { console.log('failed to list databases'); }
                );
            },
            err => { console.log('failed to change owner'); }
        );
    }


    db_delete(db: Database) {
        this.msg = '';
        this.err_msg = '';
        this.dbService.remove(db).subscribe(
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


    declare_db() {
        this.msg = '';
        this.err_msg = '';
        if(!this.db.owner || !this.db.name) {
            this.err_msg = 'no database or owner selected';
            return;
        }
        this.dbService.declare(this.db).subscribe(
            resp => {
                this.msg = resp['message'];
                this.db = new Database();
                this.dbService.list().subscribe(
                    resp => { this.databases = resp; },
                    err => { console.log('failed to list databases'); }
                );
            },
            err => { this.err_msg = err.error.message; }
        );
    }


    pending_list() {
        this.pending_databases = [];
        this.dbService.list_pending(true).subscribe(
            resp => {
                if (resp.length == 0) {
                    this.pending_number = 0;
                    return;
                }
                let data = resp;
                if (data.length > 0) { 
                    this.requests_visible = true;
                    for (let i = 0; i < data.length; i++) {
                        data[i].created_at = parseInt(data[i]._id.substring(0, 8), 16) * 1000;
                    }
                }
                this.pending_number = data.length;
                this.pending_databases = data;
            },
            err => { console.log(err); }
            // err => console.log('failed to get pending databases')
        );
    }


    db_list() {
        this.dbService.list().subscribe(
            resp => { this.databases = resp; },
            err => { console.log('failed to get databases'); }
        );
    }


    refuse_selected_databases() {
        this.dbmsg = '';
        this.dbmsg_error = '';
        this.selecteddb.forEach((ws) => {
            this.dbService.refuse(ws).subscribe(
                resp => {
                    this.dbmsg = resp['message'];
                },
                err => {
                    this.dbmsg_error = err.error.message;
                    console.log('failed to reject database');
                }
            );
        });
        this.pending_list();
    }


    validate_selected_databases() {
        for (var i = 0; i < this.selecteddb.length; i++) {
            this.dbmsg='';
            this.dbmsg_error='';
            this.dbService.create(this.selecteddb[i]).subscribe(
                resp => {
                    this.dbmsg = resp['message'];
                },
                err => {
                    this.dbmsg_error = err.error.message;
                    console.log('failed to add database');
                }
            );
        }
        this.pending_list();
        this.db_list();
    }
}
