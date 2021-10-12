import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfigService } from 'src/app/config.service';
import { BillingService } from 'src/app/admin/billing/billing.service';
import { ProjectsService } from 'src/app/admin/projects/projects.service';
import { UserService } from 'src/app/user/user.service';
import { Table } from 'primeng/table';

@Component({
    selector: 'app-bill',
    templateUrl: './bill.component.html',
    styleUrls: ['./bill.component.css']
})
export class BillComponent implements OnInit {
    @ViewChild('dtp') table: Table;

    config: any
    bill: any
    bill_err_msg: string
    bill_msg: string

    all_users: any[]

    enable_prices: any[]

    bill_projects: any[]
    all_projects: any[]

    new_project: string
    old_project: string
    projects_size: number
    projects_cpu: number

    constructor(
        private route: ActivatedRoute,
        private configService: ConfigService,
        private billingService: BillingService,
        private projectsService: ProjectsService,
        private userService: UserService,
        private router: Router
    ) {
        this.bill = {};
        this.bill_projects = [];
        this.all_projects = [];
        this.config = {};
        this.new_project = '';
        this.old_project = '';
        this.projects_size = 0;
        this.projects_cpu = 0;
        this.enable_prices = [];
        this.all_users = [];
    }

    ngOnDestroy(): void {
    }

    ngAfterViewInit(): void {
    }

    ngOnInit() {
        this.route.params
            .subscribe(params => {
                let billId = params.id;
                this.show_bill_projects(billId);
            });
        this.projectsService.list(true).subscribe(
            resp => {
                this.all_projects = resp;
            },
            err => console.log('failed to get billing')
        )
        this.configService.config.subscribe(
            resp => {
                this.config = resp;
            },
            err => console.log('failed to get config')
        );
        this.billingService.listPrice(false).subscribe(
            resp => {
                this.enable_prices = resp;
            },
            err => console.log('failed to get price')
        );
        this.userService.list().subscribe(
            resp => this.all_users = resp,
            err => console.log('failed to get all users')
        );
    }

    show_bill_projects(bill_uuid) {
        this.reset_bill();

        this.billingService.get(bill_uuid).subscribe(
            resp => {
                this.bill = resp;
                this.billingService.getProjects(bill_uuid).subscribe(
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
            },
            err => console.log('failed to get bill')
        )
    }

    add_project() {
        this.billingService.addProject(this.bill.uuid, this.new_project).subscribe(
            resp => {
                this.bill_msg = resp['message'];
                this.show_bill_projects(this.bill.uuid);
            },
            err => this.bill_err_msg = err.error.message
        )
    }

    remove_project() {
        this.billingService.removeProject(this.bill.uuid, this.old_project).subscribe(
            resp => {
                this.bill_msg = resp['message'];
                this.show_bill_projects(this.bill.uuid);
            },
            err => this.bill_err_msg = err.error.message
        );
    }

    update_bill() {
        this.billingService.updateBill(
            this.bill.uuid,
            {
                'name': this.bill.name,
                'owner': this.bill.owner,
                'price': this.bill.price,
                'size': this.bill.size,
                'cpu': this.bill.cpu,
                'period': this.bill.period,
                'created_at': this.bill.created_at,
                'validate_at': this.bill.validate_at,
                'expire_at': this.bill.expire_at,
                'description': this.bill.description,
                'orga': this.bill.orga,
                'status': this.bill.status
            }
        ).subscribe(
            resp => {
                this.bill_msg = resp['message'];
                this.show_bill_projects(this.bill.uuid);
            },
            err => {
                this.bill_err_msg = err.error.message;
                this.show_bill_projects(this.bill.uuid);
            }
        )
    }

    delete_bill(bill_uuid: string) {
        this.billingService.delBill(bill_uuid).subscribe(
            resp => {
                this.router.navigate(['/admin/billing'], { queryParams: {'deleted': 'ok'}})
            },
            err => {
                console.log('failed to delete price ' + err.error.message);
                this.bill_err_msg = err.error.message;
            }
        );
    }

    wip_bill() {
        this.bill.status = 'Wip'; // todo move this in conf or in const
        this.update_bill();
    }

    activate_bill() {
        this.bill.status = 'Valid'; // todo move this in conf or in const
        this.update_bill();
    }

    update_price_on_event(new_value) {
        for(var i=0;i<this.enable_prices.length;i++){
            if (this.enable_prices[i].uuid == new_value) {
                this.bill.size = this.enable_prices[i].size;
                this.bill.cpu = this.enable_prices[i].cpu;
                this.bill.period = this.enable_prices[i].period;
            }
        }
    }

    reset_bill() {
        this.bill = {
            name: '',
            owner: '',
            price: '',
            size: 0,
            cpu: 0,
            period: 0,
            created_at: '',
            validate_at: '',
            expire_at: '',
            orga: '',
            description: '',
            status: ''
        }
        this.bill_projects = [];
        this.projects_size = 0;
        this.projects_cpu = 0;
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
