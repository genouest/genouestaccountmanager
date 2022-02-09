import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { ConfigService } from '../config.service'
import { TpserviceService } from './tpservice.service';
import { CalendarEventTimesChangedEvent } from 'angular-calendar';
import { Subject } from 'rxjs';

@Component({
    selector: 'app-tps',
    templateUrl: './tps.component.html',
    styleUrls: ['./tps.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TpsComponent implements OnInit {

    config: any

    msg: string
    errmsg: string
    resmsg: string
    reserrmsg: string

    session_user: any

    viewDate: Date
    events: any
    selectedEvent: any

    quantity: number
    fromDate: Date
    toDate: Date
    about: string
    authorized: boolean

    group_or_project: string
    name: string

    refresh: Subject<any> = new Subject();

    activeDayIsOpen: boolean = true;

    constructor(
        private authService: AuthService,
        private configService: ConfigService,
        private tpService: TpserviceService
    ) { }

    private listEvents() {
        this.tpService.list().subscribe(
            resp => {
                let events = [];
                for (var i = 0; i < resp.length; i++) {
                    let event = resp[i];
                    events.push({
                        'title': event.owner + ', ' + event.quantity + ' students',
                        'start': new Date(event.from),
                        'end': new Date(event.to),
                        'allDay': false,
                        meta: {
                            'id': event._id,
                            'owner': event.owner,
                            'quantity': event.quantity,
                            'students': event.accounts,
                            'created': event.created,
                            'name': event.name,
                            'about': event.about,
                            'over': event.over,
                            'group': event.group,
                            'project': event.project
                        }
                    });
                }
                this.events = events;
                this.refresh.next();
            },
            err => console.log('failed to log tp reservations')
        )
    }

    ngOnInit() {
        this.configService.config.subscribe(
            resp => {
                this.config = resp;
                this.group_or_project = this.config.reservation.group_or_project;

            },
            err => console.log('failed to get config')
        );
        this.fromDate = new Date();
        this.toDate = new Date();
        this.viewDate = new Date();
        this.quantity = 1;
        this.events = [];
        this.session_user = this.authService.profile;
        this.authorized = (this.session_user.is_trainer || this.session_user.is_admin);
        this.name = 'tps';
        this.listEvents();
    }

    prevMonth() {
        this.viewDate.setMonth(this.viewDate.getMonth() - 1);
        this.refresh.next();
    }

    curMonth() {
        this.viewDate = new Date();
        this.refresh.next();
    }

    nextMonth() {
        this.viewDate.setMonth(this.viewDate.getMonth() + 1);
        this.refresh.next();
    }

    reserve() {
        this.msg = '';
        this.errmsg = '';
        if (this.quantity <= 0) {
            this.reserrmsg = 'Quantity must be > 0';
            return;
        }
        if (this.fromDate > this.toDate) {
            this.reserrmsg = 'Final date must be superior to start date';
            return;
        }
        let reservation = {
            quantity: this.quantity,
            from: new Date(this.fromDate).getTime(),
            to: new Date(this.toDate).getTime(),
            about: this.about,
            group_or_project: this.group_or_project,
            name: this.name
        }
        console.log(reservation);
        this.tpService.reserve(reservation).subscribe(
            resp => {
                this.msg = resp['message'];
                this.listEvents();
            },
            err => this.errmsg = err.error.message
        )
    }

    cancel_reservation() {
        this.msg = '';
        this.errmsg = '';
        this.tpService.cancel(this.selectedEvent.id).subscribe(
            resp => this.msg = resp['message'],
            err => this.errmsg = err.error.message
        )
        this.selectedEvent.over = true;
        this.listEvents();
    }

    create_reservation() {
        this.msg = '';
        this.errmsg = '';
        this.tpService.create(this.selectedEvent.id).subscribe(
            resp => this.msg = resp['message'],
            err => this.errmsg = err.error.message
        )
        this.selectedEvent.created = true;
        this.listEvents();
    }

    remove_reservation() {
        this.msg = '';
        this.errmsg = '';
        this.tpService.remove(this.selectedEvent.id).subscribe(
            resp => this.msg = resp['message'],
            err => this.errmsg = err.error.message
        )
        this.selectedEvent.over = true;
        this.listEvents();
    }

    eventClicked(clickedEvent) {
        let event = clickedEvent.event;
        this.selectedEvent = event.meta;
        this.selectedEvent.title = event.title;
        this.selectedEvent.start = event.start;
        this.selectedEvent.end = event.end;
        if (!event.meta.group) {
            this.selectedEvent.group = {}
        }
    }

    eventTimesChanged({
        event,
        newStart,
        newEnd
    }: CalendarEventTimesChangedEvent): void {
        event.start = newStart;
        event.end = newEnd;
        this.refresh.next();
    }

    get_status(over) {
        if (over) {
            return "panel panel-danger";
        }
        else {
            return "panel panel-primary"
        }
    }

}
