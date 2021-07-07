import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { BillingService } from 'src/app/admin/billing/billing.service';
import { AuthService } from 'src/app/auth/auth.service';
import { ConfigService } from '../config.service'
import { ProjectsService } from 'src/app/admin/projects/projects.service';

import { Table } from 'primeng/table';

@Component({
    selector: 'app-bill',
    templateUrl: './bill.component.html',
    styleUrls: ['./bill.component.css']
})
export class BillComponent implements OnInit {
    @ViewChild('dtb') tablebill: Table;
    @ViewChild('dtp') tableproject: Table;

    new_bill: any
    bills: any[]
    user_projects: any[]
    bill_projects: any[]

    enable_prices: any[];

    selectedBill: any
    session_user: any
    config: any

    new_project: any
    old_project: any
    projects_size: number
    projects_cpu: number

    request_err_msg: string
    request_msg: string

    msg: string
    rm_prj_err_msg: string
    rm_prj_msg_ok: string

    constructor(
        private authService: AuthService,
        private configService: ConfigService,
        private billingService: BillingService,
        private projectsService: ProjectsService,
        private router: Router
    ) {
        this.config = {}
        this.projects_size = 0;
        this.projects_cpu = 0;
        this.user_projects = [];
        this.bill_projects = [];
        this.bills = [];
        this.enable_prices = [];

        this.new_bill = {
            name: '',
            owner: '',
            price: '',
            size: 0,
            cpu: 0,
            created_at: '',
            validate_at: '',
            expire_at: '',
            orga: '',
            description: '',
            status: ''
        }

    }

    ngOnDestroy(): void {
    }

    async ngOnInit() {

        this.new_bill = {}
        this.session_user = await this.authService.profile;

        this.billingService.list(false).subscribe(
            resp => {
                this.bills = resp;
            },
            err => console.log('failed to get billing')
        )

        this.projectsService.list(false).subscribe(
            resp => {
                this.user_projects = resp;
            },
            err => console.log('failed to get billing')
        )

        this.configService.config.subscribe(
            resp => {
                this.config = resp;
            },
            err => console.log('failed to get config')
        )

        this.billingService.listPrice(false).subscribe(
            resp => {
                this.enable_prices = resp;
            },
            err => console.log('failed to get price')
        );
    }

    ask_for_bill() {
        this.new_bill.owner = this.session_user.uid
        this.request_msg = '';
        this.request_err_msg = '';
        this.billingService.askNew(this.new_bill).subscribe(
            resp => {
                this.request_msg = 'An email have been sent to admin';
                this.new_bill = {};
            },
            err => {
                console.log('failed to get bill projects', err);
                this.request_err_msg = err.error.message;
            }
        )
    }

    show_bill_projects(bill) {
        this.projects_size = 0;
        this.projects_cpu = 0;
        this.selectedBill = bill;
        this.bill_projects = []

        this.billingService.getProjects(bill.uuid).subscribe(
            resp => {
                this.bill_projects = resp;
                for(var i=0;i<this.bill_projects.length;i++){
                    if(this.bill_projects[i].size) {
                        this.projects_size += this.bill_projects[i].size;
                    }
                    if(this.bill_projects[i].cpu) {
                        this.projects_cpu += this.bill_projects[i].cpu;
                    }
                }
            },
            err => console.log('failed to get bill projects')
        )
    }

    add_project() {
        this.billingService.addProject(this.selectedBill.uuid, this.new_project).subscribe(
            resp => {
                this.request_msg = resp['message'];
                this.show_bill_projects(this.selectedBill);
            },
            err => this.request_err_msg = err.error.message
        )
    }

    remove_project() {
        this.billingService.removeProject(this.selectedBill.uuid, this.old_project).subscribe(
            resp => {
                this.request_msg = resp['message'];
                this.show_bill_projects(this.selectedBill);
            },
            err => this.request_err_msg = err.error.message
        );
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
}
