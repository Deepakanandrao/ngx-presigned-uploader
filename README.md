# NgxPresignedUploader

A simple single file s3 uploader inspired by [ngx-uploader](https://github.com/jkuri/ngx-uploader).

## Installation

  1. Install

```bash
	npm install ngx-presigned-uploader --save
```

  2. Import into the module where you will use it.


```typescript
// app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { NgUploaderModule } from 'ngx-uploader';
import { NgxPresignedUploaderModule } from 'ngx-presigned-uploader';

@NgModule({
  imports: [
    BrowserModule,
    NgUploaderModule,
    NgxPresignedUploaderModule
  ],
  declarations: [ AppComponent ],
  exports: [ AppComponent ]
})
export class AppModule {}

```

## Usage

Add the presigned-uploader component to your template and pass in the serverEndpoint. Optional arguments include: headers (for requests to server), s3Prefix, fileTypes.
The component will make a request to the server to request a presigned url and use that key to upload the file. The server should return the presigned url as plain text to be consumed by the component.

The status of the upload will output to the uploadState event emitter and can be used to track the upload progress.

The interfaces looks like this:

```typescript

export interface UploadState {
  status: 'ready' | 'uploading' | 'done' | 'success' | 'error' | 'cancelled';
  file: File;
  source?: string;
  progress: {
    timeRemaining: number | null;
    speed: number | null;
    percentCompleted: number | null;
    speedHuman: string | null;
  };
  response: any;
  error: any;
}

export type PresignedUploaderActions = 'cancel';
```

Current only the cancel is available but more can be added.


### Component Code

```typescript

import { Component, EventEmitter } from '@angular/core';
import { UploadState, PresignedUploaderActions } from 'ngx-presigned-uploader';
import { environment } from './environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html'
})
export class AppComponent {
    s3Prefix: 'cache';
    fileTypes: '.jpeg,.png,.gif';
    headers: {"Authorization": "Bearer token123"}; // Optional
    serverEndpoint= environment.presignEndpoint; // store endpoint in environment
    uploadActions: EventEmitter<PresignedUploaderActions> = new EventEmitter<PresignedUploaderAction>(); // Used to conduct actions.

    constructor() {  }

    onProgress(UploadState) {
        console.log('upload state: ', uploadState);
    }

    cancelUpload() {
        this.uploadActions.emit('cancel');
    }
}

```

You can store your server endpoint in environments folder to separate development from production.


### Template Code

Use the presigned-uploader component in your template.

```html

    <presigned-uploader
        [serverEndpoint]="serverEndpoint"
        [headers]="requestHeaders"
        [s3Prefix]="s3Prefix"
        [fileTypes]="acceptedFileTypes"
        [action]="uploadActions"
        (uploadState)="onProgress($event)"
        (completed)="completedUploads($event)">
    </presigned-uploader>

```

## License

MIT