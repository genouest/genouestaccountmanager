import { BrowserModule } from '@angular/platform-browser';
import { NgModule, Injectable } from '@angular/core';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';

import { DataTablesModule } from 'angular-datatables';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { UserComponent } from './user/user.component';
import { LoginComponent } from './auth/login/login.component';
import { LogoutComponent } from './auth/logout/logout.component';
import { HomeComponent } from './home/home.component';
import { MyDeleteConfirmComponent } from './my-delete-confirm/my-delete-confirm.component';
import { TpsComponent } from './tps/tps.component';
import { ProjectComponent } from './project/project.component';
import { UsersComponent, MyStatusFilterPipe } from './admin/users/users.component';
import { GroupsComponent } from './admin/groups/groups.component';
import { ProjectsComponent as AdminProjectsComponent} from './admin/projects/projects.component';
import { ProjectComponent as AdminProjectComponent} from './admin/project/project.component';
import { MessagesComponent } from './admin/messages/messages.component';
import { DatabasesComponent } from './admin/databases/databases.component';
import { WebsitesComponent } from './admin/websites/websites.component';
import { LogsComponent } from './admin/logs/logs.component';
import { RegisterComponent } from './auth/register/register.component';
import { InfoComponent } from './info/info.component';
import { RegisteredInfoComponent } from "./info/RegisteredInfoComponent";
import { PendingApprovalInfoComponent } from "./info/PendingApprovalInfoComponent";
import { RenewInfoComponent } from "./info/RenewInfoComponent";
import { PwdResetConfirmInfoComponent } from "./info/PwdResetConfirmInfoComponent";
import { PluginDirective, PluginComponent, TestPluginComponent, GalaxyPluginComponent, DataAccessPluginComponent, PopulateHomePluginComponent, GenostackPluginComponent, QuotasPluginComponent, GomailPluginComponent } from './plugin/plugin.component';
import { ProjectsComponent as UserProjectsComponent} from './user/projects/projects.component';
import { RegisteredComponent } from './callback/registered/registered.component';
import { PasswordResetConfirmComponent } from './callback/password-reset-confirm/password-reset-confirm.component';
import { UserExtendComponent } from './callback/user-extend/user-extend.component';
import { PendingAccountComponent } from './callback/pending-account/pending-account.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { AuthInterceptor } from './auth/auth.service';
import { BasePluginComponent } from './plugin/base-plugin/base-plugin.component';
import { WindowWrapper, getWindow } from './windowWrapper.module';
import { FlashComponent } from './utils/flash/flash.component';


@NgModule({
  declarations: [
    AppComponent,
    UserComponent,
    LoginComponent,
    LogoutComponent,
    HomeComponent,
    MyDeleteConfirmComponent,
    TpsComponent,
    ProjectComponent,
    UsersComponent,
    GroupsComponent,
    AdminProjectsComponent,
    AdminProjectComponent,
    UserProjectsComponent,
    MessagesComponent,
    DatabasesComponent,
    WebsitesComponent,
    LogsComponent,
    RegisterComponent,
    InfoComponent,
    RegisteredInfoComponent,
    PendingApprovalInfoComponent,
    RenewInfoComponent,
    PwdResetConfirmInfoComponent,
    PluginComponent,
    TestPluginComponent,
    GalaxyPluginComponent,
    DataAccessPluginComponent,
    PopulateHomePluginComponent,
    GenostackPluginComponent,
    QuotasPluginComponent,
    GomailPluginComponent,
    PluginDirective,
    MyStatusFilterPipe,
    RegisteredComponent,
    PasswordResetConfirmComponent,
    UserExtendComponent,
    PendingAccountComponent,
    BasePluginComponent,
    FlashComponent
  ],
  imports: [
    BrowserModule,
    NgbModule,
    HttpClientModule,
    AppRoutingModule,
    FormsModule,
    DataTablesModule,
    BrowserAnimationsModule,
    CalendarModule.forRoot({
      provide: DateAdapter,
      useFactory: adapterFactory
    })
  ],
  providers: [
    {provide: WindowWrapper, useFactory: getWindow, multi: true},
    {provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true}
  ],
  bootstrap: [AppComponent],
  entryComponents: [
    TestPluginComponent,
    GalaxyPluginComponent,
    DataAccessPluginComponent,
    PopulateHomePluginComponent,
    GenostackPluginComponent,
    QuotasPluginComponent,
    GomailPluginComponent
  ]
})
export class AppModule { }
