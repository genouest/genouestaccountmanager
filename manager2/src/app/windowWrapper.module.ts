import { Injectable } from "@angular/core";

@Injectable()
export class WindowWrapper extends Window {

}

export function getWindow() { return window; }