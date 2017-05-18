import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PresignedUploaderComponent } from './presigned-uploader.component';

@NgModule({
	imports: [CommonModule],
	declarations: [PresignedUploaderComponent],
	exports: [PresignedUploaderComponent]
})
export class NgxPresignedUploaderModule { }
