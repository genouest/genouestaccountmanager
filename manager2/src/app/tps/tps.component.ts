import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AuthService } from '../auth/auth.service';
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

    msg: string
    errmsg: string
    resmsg: string
    reserrmsg: string

    viewDate: Date
    events: any
    selectedEvent: any

    quantity: number
    fromDate: Date
    toDate: Date
    about: string
    authorized: boolean

    refresh: Subject<any> = new Subject();

    activeDayIsOpen: boolean = true;

    constructor(
        private authService: AuthService,
        private tpService: TpserviceService
    ) { }

    private listEvents(){
        this.tpService.list().subscribe(
            resp => {
                let events = [];
                for(var i = 0;i < resp.length;i++){
                    let event = resp[i];
                    events.push({
                        'title': event.owner+', '+ event.quantity+' students',
                        'start': new Date(event.from),
                        'end': new Date(event.to),
                        'allDay': false,
                        meta: {
                            'id': event._id,
                            'owner': event.owner,
                            'quantity': event.quantity,
                            'students': event.accounts,
                            'created': event.created,
                            'about': event.about,
                            'over': event.over,
                            'group': event.group,
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
        this.fromDate = new Date();
        this.toDate = new Date();
        this.viewDate = new Date();
        this.quantity = 1;
        this.events = [];
        this.authorized = (this.authService.profile.is_trainer || this.authService.profile.is_admin);
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

    reserve(){
        this.msg = '';
        this.errmsg = '';
        if (this.quantity <= 0) {
            this.reserrmsg = 'Quantity must be > 0';
            return;
        }
        if(this.fromDate > this.toDate) {
            this.reserrmsg = 'Final date must be superior to start date';
            return;
        }
        let reservation = {
            quantity: this.quantity,
            from: new Date(this.fromDate).getTime(),
            to: new Date(this.toDate).getTime(),
            about: this.about
        }
        this.tpService.reserve(reservation).subscribe(
            resp => {
                this.msg = resp['message'];
                this.listEvents();
            },
            err => this.errmsg = err.error.message
        )
    }

    cancel_reservation(){
        this.msg = '';
        this.errmsg = '';
        this.tpService.cancel(this.selectedEvent.id).subscribe(
            resp => this.msg = resp['message'],
            err => this.errmsg = err.error.message
        )
    }


    eventClicked(clickedEvent) {
        let event = clickedEvent.event;
        this.selectedEvent = event.meta;
        this.selectedEvent.title = event.title;
        this.selectedEvent.start = event.start;
        this.selectedEvent.end = event.end;
        if (! event.meta.group) {
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
        if(over) {
            return "panel panel-danger";
        }
        else {
            return "panel panel-primary"
        }
    }

}
