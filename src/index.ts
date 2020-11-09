import {EMPTY, fromEvent, interval, Observable, of} from 'rxjs';
import {first, take, tap, withLatestFrom} from 'rxjs/operators';

const btn: HTMLButtonElement = document.getElementById('btn') as HTMLButtonElement;
let latest$: Observable<any> = interval(1000).pipe(
    tap((i) => {
        console.log('WithLatestFrom observable called after subscribed', i)
    }),
    take(10)
);

let click$ = fromEvent(btn, 'click');

click$.pipe(
    withLatestFrom(latest$)
).subscribe((...args) => {
    console.log('Clicked', args);
})
