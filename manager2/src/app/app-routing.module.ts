import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AuthGuard, AdminAuthGuard } from './auth/auth.guard';

import { HomeComponent } from './home/home.component';
import { UserComponent } from './user/user.component';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { LogoutComponent } from './auth/logout/logout.component';
import { TpsComponent } from './tps/tps.component';
import { ProjectComponent } from './project/project.component';
import { DatabasesComponent as AdminDatabaseComponent} from './admin/databases/databases.component';
import { GroupsComponent as AdminGroupComponent} from './admin/groups/groups.component';
import { LogsComponent as AdminLogComponent} from './admin/logs/logs.component';
import { MessagesComponent as AdminMessageComponent} from './admin/messages/messages.component';
import { ProjectsComponent as AdminProjectsComponent} from './admin/projects/projects.component';
import { ProjectComponent as AdminProjectComponent} from './admin/project/project.component';
import { BillingComponent as AdminBillingComponent} from './admin/billing/billing.component';
import { BillComponent as AdminBillComponent} from './admin/bill/bill.component';
import { BillComponent as UserBillComponent} from './bill/bill.component';
import { UsersComponent as AdminUserComponent} from './admin/users/users.component';
import { WebsitesComponent as AdminWebsiteComponent} from './admin/websites/websites.component';
import { RegisteredInfoComponent } from "./info/RegisteredInfoComponent";
import { PendingApprovalInfoComponent } from "./info/PendingApprovalInfoComponent";
import { RenewInfoComponent } from "./info/RenewInfoComponent";
import { PwdResetConfirmInfoComponent } from "./info/PwdResetConfirmInfoComponent";
import { RegisteredComponent } from './callback/registered/registered.component';
import { PasswordResetConfirmComponent } from './callback/password-reset-confirm/password-reset-confirm.component';
import { PendingAccountComponent } from './callback/pending-account/pending-account.component';
import { AdminpluginComponent } from './admin/adminplugin/adminplugin.component';
import { AdminStatComponent } from './admin/stats/stats.component';

const routes: Routes = [
    {
        path: 'user/:id',
        component: UserComponent,
        canActivate: [
            AuthGuard
        ]
    },
    {
        path: 'tps',
        component: TpsComponent,
        canActivate: [
            AuthGuard
        ]
    },
    {
      path: 'project',
      component: ProjectComponent,
      canActivate: [
        AuthGuard
      ]
    },
    {
      path: 'bill',
      component: UserBillComponent,
      canActivate: [
        AuthGuard
      ]
    },
    {
        path: 'admin/user',
        component: AdminUserComponent,
        canActivate: [
            AdminAuthGuard
        ]
    },
    {
        path: 'admin/group',
        component: AdminGroupComponent,
        canActivate: [
            AdminAuthGuard
        ]
    },
    {
        path: 'admin/project',
        component: AdminProjectsComponent,
        canActivate: [
            AdminAuthGuard
        ]
    },
    {
        path: 'admin/stats',
        component: AdminStatComponent,
        canActivate: [
            AdminAuthGuard
        ]
    },
    {
        path: 'admin/project/:id',
        component: AdminProjectComponent,
        canActivate: [
            AdminAuthGuard
        ]
    },
    {
      path: 'admin/billing',
      component: AdminBillingComponent,
      canActivate: [
        AdminAuthGuard
      ]
    },
    {
      path: 'admin/bill/:id',
      component: AdminBillComponent,
      canActivate: [
        AdminAuthGuard
      ]
    },
    {
        path: 'admin/message',
        component: AdminMessageComponent,
        canActivate: [
            AdminAuthGuard
        ]
    },
    {
        path: 'admin/database',
        component: AdminDatabaseComponent,
        canActivate: [
            AdminAuthGuard
        ]
    },
    {
        path: 'admin/web',
        component: AdminWebsiteComponent,
        canActivate: [
            AdminAuthGuard
        ]
    },
    {
        path: 'admin/log',
        component: AdminLogComponent,
        canActivate: [
            AdminAuthGuard
        ]
    },
    {
        path: 'admin/plugin/:id',
        component: AdminpluginComponent,
        canActivate: [
            AdminAuthGuard
        ]
    },
    {
        path: 'login',
        component: LoginComponent
    },
    {
        path: 'register',
        component: RegisterComponent
    },
    {
        path: 'logout',
        component: LogoutComponent
    },
    {
        path: 'pending',
        component: PendingApprovalInfoComponent
    },
    {
        path: 'registered',
        component: RegisteredInfoComponent
    },
    {
        path: 'passwordresetconfirm',
        component: PwdResetConfirmInfoComponent
    },
    {
        path: 'user/:id/renew/:regkey',
        component: RenewInfoComponent
    },
    {
        path: 'registered',
        component: RegisteredComponent
    },
    {
        path: 'passwordresetconfirm',
        component: PasswordResetConfirmComponent
    },
    {
        path: 'pending',
        component: PendingAccountComponent
    },
    {
        path: '',
        component: HomeComponent
    },
    {
        path: '**',
        component: HomeComponent
    }
];

@NgModule({
    imports: [RouterModule.forRoot(
        routes,
        { enableTracing: false } // <-- debugging purposes only
    )],
    exports: [RouterModule],
    providers: [AuthGuard]
})
export class AppRoutingModule {}
