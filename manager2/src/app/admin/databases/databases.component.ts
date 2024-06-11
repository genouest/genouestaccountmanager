import { Component, OnInit, ViewChild } from '@angular/core';
import { Database, DatabaseService } from 'src/app/user/database.service';
import { UserService } from 'src/app/user/user.service';

import { Table } from 'primeng/table';

@Component({
    selector: 'app-database',
    templateUrl: './databases.component.html',
    styleUrls: ['./databases.component.css']
})
export class DatabasesComponent implements OnInit {
    @ViewChild('dtp') table: Table;


    db: Database
    owner_db_name: any
    owner_db_owner: any
    chowner_msg: string
    chowner_err_msg: string

    databases: Database[]
    users: any
    selecteddb: Database[]

    requests_visible: boolean
    pending_databases: any
    pending_number: any
    pending_msg: string
    pending_error_msg: string
    
    msg: string
    err_msg: string
    dbmsg: string
    dbmsg_error: string
    

    constructor(private dbService: DatabaseService, private userService: UserService) { }

    ngAfterViewInit(): void {
    }



    ngOnDestroy(): void {
    }

    ngOnInit() {
        this.db = new Database('','mysql','','', false, "", "", "",true)
        this.db_list()
        this.userService.list().subscribe(
            resp => this.users = resp,
            err => console.log('failed to get users')
        )
        this.pending_list()
        this.selecteddb = []
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
                    resp => {this.databases = resp;},
                    err => console.log('failed to list databases')
                )
            },
            err => console.log('failed to change owner')
        )
    }

    declare_db() {
        this.msg = '';
        this.err_msg = '';

        if(!this.db.owner || !this.db.name){
            this.err_msg = 'no database or owner selected';
            return;
        }
        this.dbService.add(this.db).subscribe(
            resp => {
                this.msg = resp['message'];
                this.db = new Database('','mysql','','', false, "", "", "",true);
                this.dbService.list().subscribe(
                    resp => {this.databases = resp;},
                    err => console.log('failed to list databases')
                )
            },
            err => this.err_msg = err.error.message
        )
    }

    pending_list(refresh_requests = false) {
        this.pending_databases = [];
        this.dbService.list_pending(true).subscribe(
            resp => {
                if (resp.length == 0) {
                    this.pending_number = 0;
                    return;
                }
                if (refresh_requests) {
                    this.pending_number = 0;
                }
                let data = resp;
                if (data.length > 0) { 
                    this.requests_visible = true;
                    for (let i = 0; i < data.length; i++) {
                        data[i].created_at = parseInt(data[i]['_id'].substring(0, 8), 16) * 1000
                    }
                };
                this.pending_number = data.length;
                this.pending_databases = data;
            },
            err => console.log(err)
            // err => console.log('failed to get pending databases')
        );
    }

    db_list() {
        this.dbService.list().subscribe(
            resp => {this.databases = resp;},
            err => console.log('failed to get databases')
        )
    }
    date_convert = function timeConverter(tsp){
        let res;
        try {
            var a = new Date(tsp);
            res = a.toISOString().substring(0, 10);
        }
        catch (e) {
            res = '';
        }
        return res;
    }


    refuse_selected_databases() {
        this.dbmsg = '';
        this.dbmsg_error = '';
        this.selecteddb.forEach((ws)=>{
            this.dbService.refuse(ws).subscribe(
                resp => { this.dbmsg = resp['message'];
                this.pending_list()},
                err => { this.dbmsg_error = err.error.message; console.log('failed to reject database')}
            )
            
        });
        
    }

    validate_selected_databases() {
        
        for (var i = 0; i < this.selecteddb.length; i++) {
            this.dbmsg='';
            this.dbmsg_error='';

            this.dbService.add(new Database(
                this.selecteddb[i].name,
                this.selecteddb[i].type,
                this.selecteddb[i].host,
                this.selecteddb[i].owner,
                this.selecteddb[i].create,
                this.selecteddb[i].usage,
                this.selecteddb[i].size,
                this.selecteddb[i].expire,
                this.selecteddb[i].single_user)).subscribe(
            resp => { this.dbmsg = resp['message'];
            this.pending_list()
            this.db_list()},
            err => { this.dbmsg_error = err.error.message; console.log('failed to add database')}
        )
            

        }
        
    }
}

