// place files you want to import through the `$lib` alias in this folder.


export function delay(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, ms);
    })
}



export class TimeSpan {
    private _seconds: number;
    constructor(houre: number, muinute: number, second: number) {

        this._seconds = second + muinute * 60 + houre * 60 * 60;
    }


    public get minutes(): number {
        return Math.floor(this._seconds / 60) % 60;
    }


    public get seconds(): number {
        return Math.floor(this._seconds % 60);
    }

    public get totalSeconds(): number {
        return Math.floor(this._seconds);
    }


    public get hours(): number {
        return Math.floor(this._seconds / 60 / 60);
    }

    /**
     * toString
     */
    public toString(format?: 'full') {
        const zeroPad = (num: number, places: number) => String(num).padStart(places, '0')
        if (format != 'full') {

            if (this.minutes == 0 && this.hours == 0) {
                return `${this.seconds}s`;
            } else if (this.hours == 0) {
                return `${this.minutes}:${zeroPad(this.seconds, 2)} min`;
            }
            return `${this.hours}:${zeroPad(this.minutes, 2)}:${zeroPad(this.seconds, 2)} h`;
        }
        return `${zeroPad(this.hours, 2)}:${zeroPad(this.minutes, 2)}:${zeroPad(this.seconds, 2)} h`;
    }

    public static substract(a: Date, b: Date): TimeSpan {
        return new TimeSpan(0, 0, (a.getTime() - b.getTime()) / 1000)
    }


    public static Parse(text: string): TimeSpan {
        const times = text.split(':').map(x => parseInt(x)) as [number, number, number];
        const span = new TimeSpan(...times);
        return span;
    }
}