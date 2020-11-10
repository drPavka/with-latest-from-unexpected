import {webSocket, WebSocketSubject} from 'rxjs/webSocket';
import {from, fromEvent, Observable, Subject, Subscription, timer} from 'rxjs';
import {delayWhen, filter, finalize, first, map, switchMap, takeWhile, tap} from 'rxjs/operators';

export interface IWsMessage<T> {
    msg: string;
    data: T;
    id: number;
    code?: number;
    info?: string;
}

const RECONNECTION_INTERVAL = [1, 2, 5, 10, 30, 60];

class MessageService {
    private index = 0;
    private webSocket$$: WebSocketSubject<any> = webSocket({
        url: 'ws://localhost:3000/',
        openObserver: {
            next: () => {
                console.debug('Connection established');
                this.connected = true;
            }
        },
        closeObserver: {
            next: (event: CloseEvent) => {
                console.debug('Connection closed, code:', event.code);
                this.connected = false;
            }
        }
    });
    private socket$ = this.webSocket$$.asObservable();

    private messages$$: Subject<IWsMessage<any>> = new Subject<IWsMessage<any>>();
    private messages$: Observable<IWsMessage<any>> = this.messages$$.asObservable();
    private subscription: Subscription = new Subscription();
    private intervalSubscription = new Subscription();
    /**
     * connection timeline period
     * @private
     */
    private connectionInterval$: Observable<number> = from(RECONNECTION_INTERVAL).pipe(
        delayWhen((period, index) => {
            console.time('a' + period);
            return timer(period * 1000);
        }),
        tap(v => console.timeLog('a' + v)),
        map(v => {
            return RECONNECTION_INTERVAL[RECONNECTION_INTERVAL.indexOf(v) + 1] || 0;
        })
    );
    private connected = false;
    private connecting$$: Subject<any> = new Subject<any>();
    private connecting$: Observable<any> = this.connecting$$.asObservable().pipe(
        takeWhile(() => !this.connected),
        tap(() => console.log('++++++++++'))
    );

    public send$<T>(msg: string, data: any): Observable<T> {
        this.webSocket$$.next({
            id: ++this.index,
            msg,
            data
        });
        return this.messages$.pipe(
            filter((response) => {
                return response.id === this.index;
            }),
            map(_ => _.data as T),
            first()
        )
    }

    public close(): void {

    }

    constructor() {
        this.intervalSubscription.add(this.connectionInterval$.subscribe(this.connecting$$));
        this.connecting$.pipe(
            tap(() => {
                console.log('connection attempt', this.connected);

                this.socket$.subscribe({
                    next: (response: IWsMessage<any>) => {
                        if (!response.code || response.code !== 200) {
                            console.error(response.info || ' Server error')
                        } else this.messages$$.next(response);
                    },
                    error: (e) => {
                        console.log(e)
                    }
                })
            }),
            finalize(() => {
                console.log('Connection completed', this.connected);
                this.intervalSubscription.unsubscribe();
            })
        ).subscribe(

        );

    }
}

const service: MessageService = new MessageService();

const relogin: HTMLButtonElement = document.querySelector('#relogin') as HTMLButtonElement;

fromEvent(relogin, 'click').pipe(
    switchMap(() => {
        return service.send$('reLogin', {
            app_token: 'jKNW9uscTp6CTmHiouUfWXVwOf4NBBBDZ2GC4qJ29UcY9PWp3t4LUfhkQzkgvvqn'
        })
    })
).subscribe(
    {
        next: (a) => {
            console.log(a);
        },
        complete: () => {
            console.log('completed')
        }
    }
)
