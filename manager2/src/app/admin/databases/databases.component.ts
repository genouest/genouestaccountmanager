import { Component, OnInit, QueryList, ViewChildren } from '@angular/core';
import { Database, DatabaseService } from 'src/app/user/database.service';
import { UserService } from 'src/app/user/user.service';

import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';

@Component({
    selector: 'app-databases',
    templateUrl: './databases.component.html',
    styleUrls: ['./databases.component.css']
})
export class DatabasesComponent implements OnInit {
    @ViewChildren(DataTableDirective)
    tables: QueryList<DataTableDirective>;

    dtTrigger: Subject<any> = new Subject()

    db: Database
    owner_db_name: any
    owner_db_owner: any
    chowner_msg: string
    chowner_err_msg: string

    databases: Database[]
    users: any

    msg: string
    err_msg: string

    constructor(private dbService: DatabaseService, private userService: UserService) { }

    ngAfterViewInit(): void {
        this.dtTrigger.next();
    }

    renderDataTables(): void {
        this.tables.forEach(table => {
            if (table.dtTrigger) {
                table.dtInstance.then((dt: DataTables.Api) => {
                    dt.clear();
                    dt.destroy();
                    table.dtTrigger.next();

                });
            }
        });
    }

    ngOnDestroy(): void {
        this.dtTrigger.unsubscribe();
    }

    ngOnInit() {
        this.db = new Database('','mysql','','', false)
        this.dbService.list().subscribe(
            resp => {this.databases = resp; this.renderDataTables();},
            err => console.log('failed to get databases')
        )
        this.userService.list().subscribe(
            resp => this.users = resp,
            err => console.log('failed to get users')
        )
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
                    resp => {this.databases = resp; this.renderDataTables();},
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
                this.db = new Database('', 'mysql', '', '');
                this.dbService.list().subscribe(
                    resp => {this.databases = resp; this.renderDataTables();},
                    err => console.log('failed to list databases')
                )
            },
            err => this.err_msg = err.error
        )
    }

}
