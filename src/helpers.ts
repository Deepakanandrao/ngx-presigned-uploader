import { Response } from '@angular/http';
import { Observable } from 'rxjs';

export function extractData(res: Response) {
  const body = res.json();
  console.log('res: ', res);
  console.log('body: ', body);
  return body || { };
}