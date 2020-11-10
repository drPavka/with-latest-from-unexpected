import {from, interval, of, Subject, timer} from 'rxjs';
import {concatAll, delay, delayWhen, map, switchMap, take, takeUntil, takeWhile, tap} from 'rxjs/operators';

const pseudoClick$ = timer(10 * 1000);

const reconnection$$: Subject<number> = new Subject<number>();

const RECONNECTION_INTERVAL = [1, 2, 5, 10, 30, 60];

const period$ = from(RECONNECTION_INTERVAL).pipe(
    delayWhen((period, index) => {
        console.time('a' + period);
        return timer(period * 1000);
    }),
    tap(v => console.timeLog('a' + v)),
    map(v => {

        return RECONNECTION_INTERVAL[RECONNECTION_INTERVAL.indexOf(v) + 1] || 0;
    })
);

period$.pipe(

).subscribe(reconnection$$);

/*const period2$ = from([1, 2, 5, 10, 30, 60]).pipe(
    map((period) => interval(period * 1000).pipe(take(1))),
    concatAll(),
    tap(console.log.bind(console))
)*/
reconnection$$.asObservable().subscribe((v) => {
    console.log(v)
})
/*period2$.subscribe((v) => {
    //console.timeLog('b' + v);
})*/
/*timer(0,1000).pipe(
    takeUntil(period2$)
).subscribe((a) => console.log(a))*/
