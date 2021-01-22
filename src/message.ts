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
            this._timestamp = timestamp;
            this._sequence = sequence;
            this._body = bodyOrFullMessage;
            // build full message
            this._fullMessage = new ArrayBuffer(6 + this._body.byteLength);
            // set header
            // - timestamp
            new Uint32Array (this._fullMessage)[0] = this._timestamp;
            // - sequence
            new Uint16Array(this._fullMessage)[2] = this._sequence;
            // set body
            new Uint8Array(this._fullMessage).set(new Uint8Array(this._body), 6);
        } else {
            // extract headers and body from fullMessage
            this._fullMessage = bodyOrFullMessage;
            // timestamp
            this._timestamp = new Uint32Array(this._fullMessage)[0];
            // sequence
            this._sequence = new Uint16Array(this._fullMessage)[2];
            // body
            this._body = this._fullMessage.slice(6);
        }
    }

    get timestamp(): number { return this._timestamp; }
    get sequence(): number { return this._sequence; }
    get body(): ArrayBuffer { return this._body; }
    get fullMessage(): ArrayBuffer { return this._fullMessage; }

}