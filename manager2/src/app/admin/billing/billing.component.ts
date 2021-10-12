import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfigService } from 'src/app/config.service';
import { BillingService } from 'src/app/admin/billing/billing.service';
import { UserService } from 'src/app/user/user.service';

import {Table} from 'primeng/table'


@Component({
    selector: 'app-billing',
    templateUrl: './billing.component.html',
    styleUrls: ['./billing.component.css']
})
export class BillingComponent implements OnInit {
    @ViewChild('dtp') tableprice: Table;
    @ViewChild('dtb') tablebill: Table;

    config: any

    add_bill_msg: string
    add_bill_error_msg: string

    all_bills: any[]
    new_bill: any

    all_users: any[]

    add_price_msg: string
    add_price_error_msg: string
    update_price_msg: string
    update_price_error_msg: string

    all_prices: any[]
    enable_prices: any[]
    new_price: any

    day_time: number

    panel: number

    constructor(
        private route: ActivatedRoute,
        private configService: ConfigService,
        private billingService: BillingService,
        private userService: UserService,
        private router: Router
    ) {
        this.config = {};
        this.day_time = 1000 * 60 * 60 * 24;

        this.all_prices = [];
        this.enable_prices = [];
        this.new_price = {};

        this.all_bills = [];
        this.new_bill = {};

        this.all_users = [];

        this.panel = 0;
    }

    ngOnDestroy(): void {
    }


    ngOnInit() {
        this.reset_msgs()
        this.reset_price()
        this.reset_bill()

        this.route.queryParams
            .subscribe(params => {
                if(params.deleted == "ok") {
                    this.add_bill_msg = "Bill was deleted successfully";
                };
            });

        this.configService.config.subscribe(
            resp => {
                this.config = resp;
            },
            err => console.log('failed to get config')
        );

        this.userService.list().subscribe(
            resp => this.all_users = resp,
            err => console.log('failed to get all users')
        );

        this.price_list();
        this.bill_list();
    }

    ngAfterViewInit(): void {
    }

    add_price() {
        this.billingService.addPrice({
            'label': this.new_price.label,
            'size': this.new_price.size,
            'cpu': this.new_price.cpu,
            'period': this.new_price.period,
            'value': this.new_price.value
        }).subscribe(
            resp => {
                this.add_price_msg = resp.message;
                this.price_list();
                this.reset_price()
            },
            err => {
                console.log('failed to add price ' + err.error.message);
                this.add_price_error_msg = err.error.message;
            }
        );
    }

    price_list(){
        this.all_prices = []; // trigger watcher on this var for primeng
        this.billingService.listPrice(true).subscribe(
            resp => {
                this.all_prices = resp;
            },
            err => console.log('failed to get price')
        );

        this.enable_prices = [];
        this.billingService.listPrice(false).subscribe(
            resp => {
                this.enable_prices = resp;
            },
            err => console.log('failed to get price')
        );
    }


    update_price(price_uuid: string, state: string) {
        this.reset_msgs()
        this.billingService.setPrice(price_uuid, state).subscribe(
            resp => {
                this.update_price_msg = resp.message;
                this.price_list();
            },
            err => {
                console.log('failed to update price ' + err.error.message);
                this.update_price_error_msg = err.error.message;
            }
        );
    }

    delete_price(price_uuid: string) {
        this.reset_msgs()
        this.billingService.delPrice(price_uuid).subscribe(
            resp => {
                this.update_price_msg = resp.message;
                this.price_list();
            },
            err => {
                console.log('failed to delete price ' + err.error.message);
                this.update_price_error_msg = err.error.message;
            }
        );
    }

    add_bill() {

        this.reset_msgs()
        this.billingService.addBill({
            'name': this.new_bill.name,
            'owner': this.new_bill.owner,
            'price': this.new_bill.price,
            'orga': this.new_bill.orga,
            'description': this.new_bill.description
        }).subscribe(
            resp => {
                this.add_bill_msg = resp.message;
                this.bill_list();
                this.reset_bill()
            },
            err => {
                console.log('failed to add bill ' +  err.error.message);
                this.add_bill_error_msg = err.error.message;
            }
        );
    }

    delete_bill(bill_uuid: string) {
        this.reset_msgs()
        this.billingService.delBill(bill_uuid).subscribe(
            resp => {
                this.add_bill_msg = resp.message;
                this.bill_list();
            },
            err => {
                console.log('failed to delete price ' + err.error.message);
                this.add_bill_error_msg = err.error.message;
            }
        );
    }

    bill_list(){
        this.all_bills = [];
        this.billingService.list(true).subscribe(
            resp => {
                if(resp.length == 0) {
                    return;
                }
                this.all_bills = resp;
            },
            err => console.log('failed to get bill')
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

    reset_price() {
        this.new_price = {
            label: '',
            size: 250,
            cpu: 1000,
            period: 365,
            value: 0
        };
    }

    reset_bill() {
        this.new_bill = {
            name: '',
            owner: '',
            price: '',
            orga: '',
            description: ''
        };

    }

    reset_msgs() {
        this.add_price_msg = "";
        this.add_price_error_msg = "";
        this.update_price_msg = "";
        this.update_price_error_msg = "";
        this.add_bill_msg = "";
        this.add_bill_error_msg = "";
    }

    switchTo(panel) {
        this.panel = panel;
    }
}
