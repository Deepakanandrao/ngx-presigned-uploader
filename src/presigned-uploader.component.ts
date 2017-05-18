import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { Http, Headers, RequestOptions, URLSearchParams, Response } from '@angular/http';
import { Observable, BehaviorSubject } from 'rxjs';
import 'rxjs/add/observable/throw';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';

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

@Component({
	selector: 'presigned-uploader',
	template: `
		  <input type="file" (change)="fileChange($event)" placeholder="Upload file" accept="{{fileTypes}}">
	`
})
export class PresignedUploaderComponent implements OnInit {
	// Either provide a presigned s3 url or a server end point to request one.
  @Input() presignedUrl: string;
	@Input() serverEndpoint: string;
  
  // Optional headers for server requests. eg: authentication
	@Input() headers: any;
  
  // Optional s3 prefix. eg: 'cache' will save your file to s3.com/cache/[key]
  @Input() s3Prefix: string;

  // Accepted file types.
  @Input() fileTypes: string = ".jpeg,.jpg,.png";

  // Input an action to cancel the current upload.
  @Input() action: EventEmitter<PresignedUploaderActions> = new EventEmitter<PresignedUploaderActions>();

  // The state of the file being uploaded.
  @Output() uploadState: EventEmitter<UploadState> = new EventEmitter<UploadState>();
  
  // An array of past succeeded, cancelled or failed uploads.
  @Output() completed: EventEmitter<UploadState[]> = new EventEmitter<UploadState[]>();  

  // Internal state of past uploads.
  completedStates: UploadState[] = [];

	constructor(private http: Http) { }

	ngOnInit() {
    if (!this.presignedUrl && !this.serverEndpoint) {
      throw "NgxPresignedUploader: Provide a presigned s3 url or a server endpoint to fetch one."
    }
  }

  fileChange(event: any) {
    let fileList: FileList = event.target.files;
    console.log('fileList: ', fileList);
    if (fileList.length > 0) {
      let file: File = fileList[0];

      if (this.presignedUrl) {
    
        this.upload(this.presignedUrl, file).subscribe((state: UploadState) => {
          this.uploadState.emit(state);
          console.log('uploadState: ', state);
        });
      
      } else {

        let key = `${this.randomKey()}_${file.name}`;
        if (this.s3Prefix) {
          key = `${this.s3Prefix}/${key}`;
        }
        console.log('key: ', key);

        this.getPresignedUrl(this.serverEndpoint, key, this.headers).subscribe(url => {
          console.log('presigned url: ', url);
          this.upload(url, file).subscribe(state => {
            this.uploadState.emit(state);
            if (['done', 'success', 'error'].indexOf(state.status) !== -1 ) {
              this.completedStates.push(state);
              this.completed.emit(this.completedStates);
            }
          });
        });
      }
      
    }
  }

  private randomKey() {
    return Math.random().toString(36).substr(2, 5) + '-' + Math.random().toString(36).substr(2, 5);
  }

	/**
   * Customized file upload method. Source: ngx-uploader
   * @param {string} url The destination url.
   * @param {any} file The file to upload.
   */
  upload(url: string, file: any, method: 'PUT' | 'POST' = 'PUT'): Observable<UploadState> {
    console.log('upload arguments: ', { url: url, file: file });
    return new Observable(observer => {
      const xhr = new XMLHttpRequest();
      const source = url.split('?')[0];
      let cancelled = false;
      const initial: UploadState = {
        status: 'ready',
        file: file,
        progress: {
          timeRemaining: null,
          speed: null,
          percentCompleted: 0,
          speedHuman: null
        },
        response: null,
        error: null
      }

      let time: number = Date.now();

      // Handle xhr progress event.
      xhr.upload.onprogress = (e: ProgressEvent) => {
        let timeElapsed = Date.now() - time;
        let uploadSpeed: any = e.loaded / (timeElapsed / 1000);
        let timeRemaining = Math.ceil(((e.total - e.loaded) / uploadSpeed));
        let percentCompleted = Math.round((e.loaded / e.total * 100));

        let state: UploadState = {
          status: 'uploading',
          file: file,
          progress: {
            timeRemaining: timeRemaining,
            speed: uploadSpeed,
            percentCompleted: percentCompleted,
            speedHuman: `${this.humanizeBytes(uploadSpeed)}/s`
          },
          response: null,
          error: null
        }

        observer.next(state);
      };

      // Handle xhr errors.
      xhr.upload.onerror = (e: Event) => {
        observer.error(e);
        observer.complete();
      };

      // Handle xhr done state, check for cancelled, success and error states.
      xhr.onreadystatechange = (e: Event) => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          let state: UploadState = {
            status: 'done',
            file: file,
            progress: {
              timeRemaining: 0,
              percentCompleted: 100,
              speed: null,
              speedHuman: null
            },
            response: null,
            error: null
          }

          if (cancelled) {
            state.status = 'cancelled';
            state.progress.timeRemaining = null;
            state.progress.percentCompleted = null
            
            observer.next(state);
            observer.complete();
          }
          
          if (xhr.status === 200) {
            state.response =  xhr.response === ""
              ? "Success!" : JSON.parse(xhr.response);
            state.status = 'success';
            state.source = source;
          } else {
            state.status = 'error';
            try {
              state.response = JSON.parse(xhr.response);            
            } catch(e) {
              state.response = xhr.response;
            }
          }

          observer.next(state);
          observer.complete();
        }
      }

      this.action.subscribe((action: PresignedUploaderActions) => {
        if (action === 'cancel') {
          cancelled = true;

          xhr.abort();
          observer.complete();
        }
      })

      // Open connection.
      xhr.open(method, url, true);

      // Send file.
      try {
        observer.next(initial);
        xhr.send(file);
      } catch (e) {
        console.log('start error: ', e);
        observer.complete();
      }
    });
  }

  	/**
   * Get presigned key from server.
   * @param {string} key The object key to be created.
   */
  private getPresignedUrl(endpoint: string, key: string, headers?: any): Observable<string> {
    const params = new URLSearchParams();
    params.set('key', key);
    const options = new RequestOptions({ headers: headers, search: params });
    if (headers) {
      options.headers = headers;
    }
    console.log('getPresignUrl arguments: ', {endpoint: endpoint, key: key, headers: headers});

    return this.http.get(endpoint, options)
                    .map((res: Response) => res.text())
                    .catch(err => Observable.throw(err));
  }


  /**
   * Humanize bytes from ngx-uploader.
   * @param {number} bytes Number of bytes to humanize.
   */
  private humanizeBytes(bytes: number): string {
    if (bytes === 0) {
      return '0 Byte';
    }

    const k = 1024;
    const sizes: string[] = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i: number = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

}