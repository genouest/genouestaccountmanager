import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { NgForm } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { ConfigService } from '../config.service';
import { User } from '../user/user.service';
import { TpserviceService } from './tpservice.service';
import { GroupsService } from '../admin/groups/groups.service';
import { ProjectsService } from '../admin/projects/projects.service';
import { CalendarEvent, CalendarEventTimesChangedEvent } from 'angular-calendar';
import { Subject } from 'rxjs';

const eventColors = {
    created: { primary: '#00dd44' },
    pending: { primary: '#0066ff' },
    over: { primary: '#808080' }
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

    session_user: User

    viewDate: Date
    events: CalendarEvent[]
    selectedEvent: CalendarEvent
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
        private tpService: TpserviceService,
        private groupsService: GroupsService,
        private projectsService: ProjectsService
    ) { }

    private choseColor(id: string, over: boolean, created: boolean) {
        let color;
        if (over) { color = eventColors.over; }
        else {
            if (created) { color = eventColors.created; }
            else { color = eventColors.pending; }
            const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const red = (3*hash % 128).toString(16).padStart(2, '0');
            color.primary = `#${red}${color.primary.slice(3)}`;
        }
        return color;
    }

    private listEvents() {
        this.tpService.list().subscribe(
            resp => {
                const events: CalendarEvent[] = resp.map(event => {
                    return {
                        title: `${event.owner}, ${event.quantity} students`,
                        start: new Date(event.from),
                        end: new Date(event.to),
                        color: this.choseColor(event._id, event.over, event.created),
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

    reserve(form: NgForm) {
        if(form.valid) {
            this.msg = '';
            this.errmsg = '';
            if(this.about === undefined || this.about == '') {
                this.reserrmsg = 'Tell us why you need accounts';
                return;
            }
            if(typeof this.quantity !== 'number' || this.quantity <= 0) {
                this.reserrmsg = 'Quantity must be > 0';
                return;
            }
            const fromDate = new Date(this.fromDate).getTime();
            const toDate = new Date(this.toDate).getTime();
            if(isNaN(fromDate) || isNaN(toDate)) {
                this.reserrmsg = 'Invalid date format';
                return;
            }
            if(fromDate > toDate) {
                this.reserrmsg = 'End date must be superior to start date';
                return;
            }
            if(toDate < new Date().getTime()) {
                this.reserrmsg = 'End date can not be in the past';
                return;
            }
            let reservation = {
                quantity: this.quantity,
                from: fromDate,
                to: toDate,
                about: this.about,
                group_or_project: this.group_or_project,
                name: this.name
            }

            let mailOptions = {
                //origin: MAIL_CONFIG.origin,
                origin: "test@test.fr",
                subject: "TP reservation from",
                message: "test",
                html_message: "test"
            }

            this.tpService.reserve(reservation).subscribe(
                resp => {
                    this.msg = resp['message'];
                    this.listEvents();
                     // Send mail to all admin 
                    this.tpService.notifyAdminsByMail(mailOptions).subscribe(
                        resp => {
                            //this.msg += resp['message'];
                            console.log("mail sent to admin")
                        },
                        err => this.errmsg = err.error.message
                    )
                }
                ,
                err => this.errmsg = err.error.message
            )
        } else {
            form.control.markAllAsTouched();
            return;
        }
    }

    cancel_reservation() {
        this.msg = '';
        this.errmsg = '';
        this.tpService.cancel(this.selectedEvent.meta.id).subscribe(
            resp => {
                this.msg = resp['message'];
                this.selectedEvent.meta.over = true;
                this.listEvents();
            },
            err => this.errmsg = err.error.message
        );
    }

    create_reservation() {
        this.msg = '';
        this.errmsg = '';
        this.tpService.create(this.selectedEvent.meta.id).subscribe(
            resp => {
                this.msg = resp['message'];
                this.selectedEvent.meta.created = true;
                this.listEvents();
            },
            err => this.errmsg = err.error.message
        );
    }

    remove_reservation() {
        this.msg = '';
        this.errmsg = '';
        this.tpService.remove(this.selectedEvent.meta.id).subscribe(
            resp => {
                this.msg = resp['message'];
                this.selectedEvent.meta.over = true;
                this.listEvents();
            },
            err => this.errmsg = err.error.message
        );
    }

    extend_reservation() {
        this.msg = '';
        this.errmsg = '';
        if(new Date(this.new_expire).getTime() < this.selectedEvent.meta.end) {
            this.errmsg = 'Extended end date must be after current end date';
            return;
        }
        if(new Date(this.new_expire).getTime() < new Date().getTime()) {
            this.errmsg = 'Extended end date can not be in the past';
            return;
        }
        const extension = { 'to': new Date(this.new_expire).getTime() };
        this.tpService.extend(this.selectedEvent.meta.id, extension).subscribe(
            resp => {
                this.msg = resp['message'];
                this.listEvents();
            },
            err => this.errmsg = err.error.message
        );
    }

    eventClicked(clickedEvent: CalendarEvent) {
        this.selectedEvent = clickedEvent;
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

    get_status(over: boolean) {
        if(over) { return "panel panel-danger"; }
        else { return "panel panel-primary"; }
    }

}
