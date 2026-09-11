import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-password-reset-confirm',
    templateUrl: './password-reset-confirm.component.html',
    styleUrls: ['./password-reset-confirm.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PasswordResetConfirmComponent implements OnInit {
    constructor() {}

    ngOnInit() {}
}
