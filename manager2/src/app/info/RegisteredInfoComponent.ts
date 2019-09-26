import { Component, OnInit } from '@angular/core';
@Component({
    selector: 'app-info',
    template: `<p>Your account creation has been taken into account.</p>
<p>You will receive an email soon to <b>confirm your email address</b>.</p>
<br>
<p>Once confirmed, administrators will <b>manually validate</b> your account.</p>
`,
    // templateUrl: './info.component.html',
    styleUrls: ['./info.component.css']
})
export class RegisteredInfoComponent implements OnInit {
    constructor() {
    }
    ngOnInit() {
    }
}
