import {concat, from, timer} from 'rxjs';
import {delayWhen, finalize, map, tap, timeInterval} from 'rxjs/operators';

const RECONNECTION_INTERVAL = [1, 2, 5, 10/*, 30, 60*/];
const a$ = concat.apply(
    concat,
    RECONNECTION_INTERVAL.map(_ => timer(_ * 1000))
).pipe(
    map((_, index) => RECONNECTION_INTERVAL[index + 1] || 0),
    timeInterval(),
    tap(console.log.bind(console))
);
const as = a$.subscribe(
    {
        complete: () => {
            as.unsubscribe();
            a$.subscribe()
        }
    }
)


