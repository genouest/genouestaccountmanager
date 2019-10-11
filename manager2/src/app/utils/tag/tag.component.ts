import { Component, OnInit, ChangeDetectionStrategy, Input } from '@angular/core';
import { TagService } from './tag.service';

@Component({
    selector: 'app-tag',
    templateUrl: './tag.component.html',
    styleUrls: ['./tag.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagComponent implements OnInit {
    tags: string[]
    userID: string
    kindTag: string
    newTag: string
    msg: string

    tagList: string[]

    @Input()
    set user(user: any) {
      this.userID = user;
    }

    @Input()
    set tag(taglist: string[]) {
      if(taglist){
        this.tags = taglist;
      } else {
        this.tags = [];
      }
    }

    @Input()
    set kind(kind: string) {
      this.kindTag = kind;
    }


    constructor(
      private tagService: TagService,
    ) {
    }

    ngOnInit() {
        this.msg = "";
        // this.tags = [];
        this.tagList = [];
        this.newTag = '';
        this.tagService.get().subscribe(
          resp => {
              this.tagList = resp['tags'];
          },
          err => console.log('failed to get tags')
        );
    }

    addTag() {
        if (this.newTag == "" || this.tags.indexOf(this.newTag) >= 0) {
          return
        }
        this.tags.push(this.newTag);
        this.newTag = "";
    }

    deleteTag(value) {
      let index = this.tags.indexOf(value);
      if (index >= 0) {
        this.tags.splice(index, 1)
      }
    }

    updateTags() {
      if(this.tags.length == 0){
        return;
      }
      this.tagService.set(this.tags, this.kindTag, this.userID).subscribe(
        resp => {
          this.msg = "Tags updated";
        }, 
        err => {
          this.msg = "Failed to update tags";
        }
      )
    }

}