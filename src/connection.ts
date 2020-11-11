import {webSocket, WebSocketSubject} from 'rxjs/webSocket';
import {BehaviorSubject, concat, from, fromEvent, Observable, Subject, Subscription, timer} from 'rxjs';
import {
    delayWhen,
    distinctUntilChanged,
    filter,
    finalize,
    first,
    map,
    repeat,
    switchMap,
    takeWhile,
    tap, timeInterval
} from 'rxjs/operators';

export interface IWsMessage<T> {
    msg: string;
    data: T;
    id: number;
    code?: number;
    info?: string;
}

const RECONNECTION_INTERVAL = [1, 2, 5, 10, 30, 40, 50, 60];

class MessageService {
    private index = 0;
    private messages$$: Subject<IWsMessage<any>> = new Subject<IWsMessage<any>>();
    private messages$: Observable<IWsMessage<any>> = this.messages$$.asObservable();
    private events$$: Subject<IWsMessage<any>> = new Subject<IWsMessage<any>>();
    public events$: Observable<any> = this.events$$.asObservable();
    public resetReconnectionTimer$$: Subject<void> = new Subject<void>();

    private connected = false;
    private connected$$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    public connected$: Observable<boolean> = this.connected$$.asObservable().pipe(
        distinctUntilChanged(),
        tap((connected) => {
            console.log('connected observable %s', connected)
        })
    );
    private subscription: Subscription = new Subscription();
    private intervalSubscription = new Subscription();
    private connectingSubscription = new Subscription();
    /**
     * connection timeline period
     * @private
     */
    private connectionInterval$: Observable<number> = concat.apply(
        concat,
        RECONNECTION_INTERVAL.map(_ => timer(_ * 1000))
    ).pipe(
        map((_, index) => RECONNECTION_INTERVAL[index + 1] || 0),
        //takeWhile(() => !this.connected$),
        tap((a) => console.log('Connection interval emit %s', a)),
        tap((period) => {
            this.connecting$$.next(period)
        }),
    );
    private webSocket$$: WebSocketSubject<any> = webSocket({
        url: 'ws://localhost:3000/',
        openObserver: {
            next: () => {
                console.debug('Connection established');
                this.connected$$.next(this.connected = true);
                this.connecting$$.complete();
                this.connecting = false;
            }
        },
        closeObserver: {
            next: (event: CloseEvent) => {
                console.debug('Connection closed, code:', event.code);
                this.connected$$.next(this.connected = false);
            }
        }
    });
    private socket$ = this.webSocket$$.asObservable();

    private connecting = false;
    private connecting$$: Subject<number> = new Subject<number>();
    private connecting$: Observable<any> = this.connecting$$.asObservable().pipe(
        takeWhile(() => !this.connected),
        tap((next) => console.log('Next connection in %s', next))
    );

    public send$<T>(msg: string, data: any): Observable<T> {
        this.webSocket$$.next({
            id: ++this.index,
            msg,
            data
        });
        return this.messages$.pipe(
            tap(response => {
                if (!response.code || response.code !== 200) {
                    console.error(response.info || ' Server error')
                }
            }),
            filter((response) => {
                return response.id === this.index;
            }),
            map(_ => _.data as T),

            first()
        )
    }

    public close(): void {

    }

    private connect(): void {
        if (!this.connecting) {
            console.debug('Trying to connect');
            this.connecting = true;
            /*            this.resetReconnectionTimer$$.asObservable().subscribe(
                            () => {
                                this.connect();
                            }
                        );*/

            this.connectionInterval$.subscribe();
            this.connectingSubscription.add(this.connecting$.pipe(
                tap(() => {
                    console.log('connection attempt', this.connected);

                    this.socket$.subscribe({
                        next: (response: IWsMessage<any>) => {
                            if (response.msg === 'event') {
                                this.events$$.next(response.data);
                            } else {
                                this.messages$$.next(response);
                            }
                        },
                        error: (e) => {
                            console.info('Socket connection error', e);
                            this.connect();
                        }
                    })
                }),
            ).subscribe(
                {
                    complete: () => {
                        console.log('Connection completed', this.connected);
                    }
                }
            ));
        }
    }

    constructor() {
        this.connect();

    }
}

const service: MessageService = new MessageService();

const relogin: HTMLButtonElement = document.querySelector('#relogin') as HTMLButtonElement;

fromEvent(relogin, 'click').pipe(
    switchMap(() => {
        return service.send$('reLogin', {
            app_token: 'jFWZj5eEiYu0z7kpMIZXRSTpDH4AvOYvh7rEOPEeRqnHryHE0o3J4tH26mdYA4qz'
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
);
service.connected$.pipe(
    tap((connected) => {
        (document.getElementById('relogin') as HTMLButtonElement).disabled = !connected;
        (document.getElementById('retry') as HTMLButtonElement).disabled = connected;
    })
).subscribe();

(document.getElementById('retry') as HTMLButtonElement).addEventListener('click', () => {
    service.resetReconnectionTimer$$.next()
})
