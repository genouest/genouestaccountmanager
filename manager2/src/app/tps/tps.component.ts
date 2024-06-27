import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { ConfigService } from '../config.service'
import { TpserviceService } from './tpservice.service';
import { CalendarEvent, CalendarEventTimesChangedEvent} from 'angular-calendar';
import { Subject } from 'rxjs';

const eventColors = {
    green: { primary: '#00ff00' },
    cyan: { primary: '#00ffff' },
    gray: { primary: '#808080' }
};

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
    events: CalendarEvent[]
    selectedEvent: any
    refresh: Subject<any> = new Subject();

    quantity: number
    fromDate: Date
    toDate: Date
    about: string
    authorized: boolean

    group_or_project: string
    name: string

    activeDayIsOpen: boolean = true;

    new_expire: Date

    constructor(
        private authService: AuthService,
        private configService: ConfigService,
        private tpService: TpserviceService
    ) { }

    private listEvents() {
        this.tpService.list().subscribe(
            resp => {
                const events: CalendarEvent[] = resp.map(event => {
                    let color;
                    if (event.over) { color = eventColors.gray; }
                    else if (event.created) { color = eventColors.green; }
                    else { color = eventColors.cyan; }
                    return {
                        title: `${event.owner}, ${event.quantity} students`,
                        start: new Date(event.from),
                        end: new Date(event.to), 
                        allDay: true,
                        color: color,
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
                    }
                });
                this.events = events;
                this.refresh.next();
            },
            err => console.error('failed to log tp reservations', err)
        );
    }

    ngOnInit() {
        this.configService.config.subscribe(
            resp => {
                this.config = resp;
                this.group_or_project = this.config.reservation.group_or_project;
            },
            err => console.error('failed to get config', err)
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
        if (new Date(this.fromDate).getTime() > new Date(this.toDate).getTime()) {
            this.reserrmsg = 'End date must be superior to start date';
            return;
        }
        if (new Date(this.toDate).getTime() < new Date().getTime()) {
            this.reserrmsg = 'End date can not be in the past';
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
        );
    }

    cancel_reservation() {
        this.msg = '';
        this.errmsg = '';
        this.tpService.cancel(this.selectedEvent.id).subscribe(
            resp => {
                this.msg = resp['message'];
                this.selectedEvent.over = true;
                this.listEvents();
            },
            err => this.errmsg = err.error.message
        );
    }

    create_reservation() {
        this.msg = '';
        this.errmsg = '';
        this.tpService.create(this.selectedEvent.id).subscribe(
            resp => {
                this.msg = resp['message'];
                this.selectedEvent.created = true;
                this.listEvents();
            },
            err => this.errmsg = err.error.message
        );
    }

    remove_reservation() {
        this.msg = '';
        this.errmsg = '';
        this.tpService.remove(this.selectedEvent.id).subscribe(
            resp => {
                this.msg = resp['message'];
                this.selectedEvent.over = true;
                this.listEvents();
            },
            err => this.errmsg = err.error.message
        );
    }

    extend_reservation() {
        this.msg = '';
        this.errmsg = '';
        if (new Date(this.new_expire).getTime() < this.selectedEvent.end) {
            this.errmsg = 'Extended end date must be after current end date';
            return;
        }
        if (new Date(this.new_expire).getTime() < new Date().getTime()) {
            this.errmsg = 'Extended end date can not be in the past';
            return;
        }
        const extension = { 'to': new Date(this.new_expire).getTime() };
        this.tpService.extend(this.selectedEvent.id, extension).subscribe(
            resp => {
                this.msg = resp['message'];
                this.listEvents();
            },
            err => this.errmsg = err.error.message
        );
    }

    eventClicked(clickedEvent) {
        this.selectedEvent = clickedEvent.meta;
        this.selectedEvent.title = clickedEvent.title;
        this.selectedEvent.start = clickedEvent.start;
        this.selectedEvent.end = clickedEvent.end;
        if (!clickedEvent.meta.group) {
            this.selectedEvent.group = { }
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
