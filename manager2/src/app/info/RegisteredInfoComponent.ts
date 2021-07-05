import { Component, OnInit } from '@angular/core';
@Component({
    selector: 'app-info',
    template: `<div class="alert alert-info">
<p class="alert alert-success">Your account creation has been taken into account.</p>
<br>
<p>You will receive an email soon to <b>confirm your email address</b>.</p>
<p class="alert alert-warning"><b> Please check your email and your spam folder ! </b></p>
<p>Once confirmed, administrators will <b>manually validate</b> your account.</p>
</div>
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
