import {webSocket, WebSocketSubject, WebSocketSubjectConfig} from 'rxjs/webSocket';
import {BehaviorSubject, concat, from, fromEvent, Observable, Observer, Subject, Subscription, timer} from 'rxjs';
import {
    delayWhen,
    distinctUntilChanged,
    filter,
    finalize,
    first,
    map,
    repeat, share,
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

const RECONNECTION_INTERVAL = [1, 2, 5, 10, 30/*, 40, 50, 60*/];

class MessageService {
    private index = 0;
    private messages$$: Subject<IWsMessage<any>> = new Subject<IWsMessage<any>>();
    private messages$: Observable<IWsMessage<any>> = this.messages$$.asObservable();
    private events$$: Subject<IWsMessage<any>> = new Subject<IWsMessage<any>>();
    public events$: Observable<any> = this.events$$.asObservable();
    public manualConnectionRetry$$: Subject<void> = new Subject<void>();

    private isConnected = false;
    private connectionStatus$$: Subject<boolean> = new Subject<boolean>();
    public connectionStatus$: Observable<boolean> = this.connectionStatus$$.asObservable().pipe(
        share(),
        distinctUntilChanged(),
        tap(connected => this.isConnected = connected),
        tap((connected) => {
            console.log('Connection status now: %s ', connected)
        })
    );
    private reconnectingSubscription = new Subscription();
    /**
     * connection timeline period
     * @private
     */
    private reconnectionInterval$: Observable<number> = concat.apply(
        concat,
        RECONNECTION_INTERVAL.map(_ => timer(_ * 1000))
    ).pipe(
        map((_, index) => RECONNECTION_INTERVAL[index + 1] || 0),
        tap((a) => console.log('Connection interval emits %s', a)),
    );
    private socketConfig: WebSocketSubjectConfig<IWsMessage<unknown>> = {
        url: 'ws://localhost:3000/',
        openObserver: {
            next: () => {
                console.debug('Connection established');
                this.connectionStatus$$.next(true);
                this.reconnecting = false;
            }
        },
        closeObserver: {
            next: (event: CloseEvent) => {
                console.debug('Connection closed, code:', event.code);
                this.connectionStatus$$.next(false);

            }
        }
    };

    private socket$$: WebSocketSubject<any> = webSocket(this.socketConfig);
    private socket$ = this.socket$$.asObservable();
    private socketObserver: Observer<IWsMessage<any>> = {
        next: (response: IWsMessage<any>) => {
            if (response.msg === 'event') {
                this.events$$.next(response.data);
            } else {
                this.messages$$.next(response);
            }
        },
        error: (e) => {
            console.info('Socket connection error', e);

            //this.connect();
        },
        complete: () => {
            console.log('Socket connection completed');
            //this.reconnectingSubscription.unsubscribe();
        }
    }
    private reconnecting = false;
    //private reconnecting$$: Subject<number> = new Subject<number>();
    private reconnecting$: Observable<any> = this.reconnectionInterval$.pipe(
        tap(() => {
            console.log('reconnecting observable check . isConnected = %s', this.isConnected)
        }),
        takeWhile(() => !this.isConnected),
        tap((next) => console.log('Next connection in %s', next))
    );

    public send$<T>(msg: string, data: any): Observable<T> {
        this.socket$$.next({
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
        this.socket$$.complete();
    }

    private connect() {
        console.log('Connect method called. isConnected = %s', this.isConnected)
        if (!this.isConnected) {
            console.log('Connect method: subscribing to socket$ observable');
            this.socket$.subscribe(this.socketObserver);
        }

    }

    private reconnect(): void {
        if (!this.reconnecting) {
            console.debug('Trying to reconnect');
            this.reconnecting = true;
            this.reconnectingSubscription.add(
                this.reconnecting$.pipe(
                    tap(() => {
                        console.log('reconnection attempt', this.isConnected);
                        this.connect();
                    }),
                ).subscribe(
                    {
                        next: () => {
                            console.log('reconnection attempt in next>subscribe')
                        },
                        error: (e) => {
                            console.log(e, '-------------------------');
                        },
                        complete: () => {
                            console.log('ReConnection finished. Connection status %s', this.isConnected);
                        }
                    }
                ));
        }
    }

    constructor() {
        this.connect();
        this.connectionStatus$.subscribe({
            next: (connected) => {
                if (!connected) {
                    this.reconnect();
                } else {
                    console.log('Connected : unsubscribe from reconnection observable and reconnection interval observable');
                    //this.reconnectingSubscription.unsubscribe();
                }
            }
        });
        this.manualConnectionRetry$$.asObservable().pipe(
            tap(() => {
                this.connect()
            })
        ).subscribe();

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
service.connectionStatus$.pipe(
    tap((connected) => {
        (document.getElementById('relogin') as HTMLButtonElement).disabled = !connected;
        (document.getElementById('retry') as HTMLButtonElement).disabled = connected;
        (document.getElementById('close') as HTMLButtonElement).disabled = !connected;
    })
).subscribe();

(document.getElementById('retry') as HTMLButtonElement).addEventListener('click', () => {
    service.manualConnectionRetry$$.next()
});

(document.getElementById('close') as HTMLButtonElement).addEventListener('click', () => {
    service.close();
})
