/*************************************
 * Message header:
 *   - timestamp: 8 bytes
 *   - sequence: 2 bytes (0..65535)
 *************************************/

export class Message {
    private _timestamp: number;
    private _sequence: number;
    private _body: ArrayBuffer;
    private _fullMessage: ArrayBuffer;

    constructor(bodyOrFullMessage: ArrayBuffer, timestamp?: number, sequence?: number) {
        if (timestamp && sequence) {
            // body rececived: add headers to build fullMessage
            this._timestamp = /*23 + sequence * 100;*/timestamp;
            this._sequence = sequence;
            this._body = bodyOrFullMessage;
            // build full message
            this._fullMessage = new ArrayBuffer(6 + this._body.byteLength);
            // set header
            // - timestamp
            new DataView(this._fullMessage).setInt32(0, this._timestamp);
            // - sequence
            new DataView(this._fullMessage, 4).setInt16(0, this._sequence);
            // set body
            new Uint8Array(this._fullMessage).set(new Uint8Array(this._body), 6);
            //console.log(`sending sequence=${this._sequence}, timestamp=${this._timestamp}`);
        } else {
            // extract headers and body from fullMessage
            this._fullMessage = bodyOrFullMessage;
            // timestamp
            this._timestamp = new DataView(this._fullMessage).getInt32(0);
            // sequence
            this._sequence = new DataView(this._fullMessage, 4).getInt16(0);
            // body
            this._body = this._fullMessage.slice(6);
            //console.log(`received sequence=${this._sequence}, timestamp=${this._timestamp}`);
        }
    }

    get timestamp(): number { return this._timestamp; }
    get sequence(): number { return this._sequence; }
    get body(): ArrayBuffer { return this._body; }
    get fullMessage(): ArrayBuffer { return this._fullMessage; }

}