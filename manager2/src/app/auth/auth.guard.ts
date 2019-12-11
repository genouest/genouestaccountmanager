import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

@Injectable({
    providedIn: 'root'
})
export class AuthGuard implements CanActivate {

    constructor(
        private authService: AuthService,
        private router: Router
    ) {}

    canActivate(
        next: ActivatedRouteSnapshot,
        state: RouterStateSnapshot): Observable<boolean> | Promise<boolean> | boolean {
        if (!this.authService.isLoggedIn) {
            this.router.navigate(['/login']);
            return false;
        }
        return true;
    }
}

@Injectable({
    providedIn: 'root'
})
export class AdminAuthGuard implements CanActivate {

    constructor(
        private authService: AuthService,
        private router: Router
    ) {}

    canActivate(
        next: ActivatedRouteSnapshot,
        state: RouterStateSnapshot): Observable<boolean> | Promise<boolean> | boolean {
        if (!this.authService.isLoggedIn ) {
            this.router.navigate(['/login']);
            return false;
        }
        if(! this.authService.profile.is_admin) {
            this.router.navigate(['/login']);
            return false;
        }
        return true;
    }
}
