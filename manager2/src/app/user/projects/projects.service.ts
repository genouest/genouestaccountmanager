import { Injectable } from '@angular/core';


export class Project {
    owner: string
    group: string
    size: string
    expire: string
    organization: string
    description: string
    path: string
    access: string
    members: string[]

    constructor(id: string, owner: string, desc: string) {

    }
}



@Injectable({
    providedIn: 'root'
})
export class ProjectsService {

    constructor() { }
}
