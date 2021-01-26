/*************************************
 * Message header:
 *   - timestamp: 8 bytes
 *   - sequence: 2 bytes (0..65535)
 *   - type: 1 byte (1 - send ; 2 - sendAndListen ; 3 - reply ; 4 - replyAndListen)
 *   - if (type == 3 || type == 4)
 *     - source timestamp: 8 bytes
 *     - source sequence: 2 bytes
 * 
 * SYSTEM MESSAGES
 *   - body = [1] => ping
 *************************************/

export const MESSAGE_SEND             = 1;
export const MESSAGE_SEND_AND_LISTEN  = 2;
export const MESSAGE_REPLY            = 3;
export const MESSAGE_REPLY_AND_LISTEN = 4;

export const SYSTEM_MESSAGE_PING      = 1;
export const SYSTEM_MESSAGE_IM_READY  = 2;

export class Message {
    private _timestamp: number;
    private _sequence: number;
    private _type: number;
    private _sourceTimestamp?: number;
    private _sourceSequence?: number;
    private _body: ArrayBuffer;
    private _fullMessage: ArrayBuffer;
    private _clockDiff: number | undefined;

    public static parse(fullMessage: ArrayBuffer): Message {
        // extract headers and body from fullMessage
        let timestamp: number,
            sequence: number,
            type: number,
            sourceTimestamp: number,
            sourceSequence: number,
            body: ArrayBuffer;
        // timestamp
        timestamp = new DataView(fullMessage).getInt32(0);
        // sequence
        sequence = new DataView(fullMessage, 4).getInt16(0);
        // type
        type = new DataView(fullMessage, 6).getInt8(0);
        const isReply = (type === MESSAGE_REPLY || type === MESSAGE_REPLY_AND_LISTEN);
        // body
        body = fullMessage.slice(!isReply ? 7 : 13);
        if(isReply) {
            // - sourceTimestamp
            sourceTimestamp = new DataView(fullMessage, 7).getInt32(0);
            // - sourceSequence
            sourceSequence = new DataView(fullMessage, 11).getInt16(0);
            return new Message(body, timestamp, sequence, type, sourceTimestamp, sourceSequence);
        } else {
            return new Message(body, timestamp, sequence, type);
        }
    }

    constructor(body: ArrayBuffer, timestamp: number, sequence: number,
                type: number, sourceTimestamp?: number, _sourceSequence?: number) {
            // body rececived: add headers to build fullMessage
        this._timestamp = timestamp;
        this._sequence = sequence;
        this._type = type;
        this._body = body;
        const isReply = (type === MESSAGE_REPLY || type === MESSAGE_REPLY_AND_LISTEN);
        // build full message
        this._fullMessage = new ArrayBuffer((!isReply ? 7 : 13) + this._body.byteLength);
        // set header
        // - timestamp
        new DataView(this._fullMessage).setInt32(0, this._timestamp);
        // - sequence
        new DataView(this._fullMessage, 4).setInt16(0, this._sequence);
        // - type
        new DataView(this._fullMessage, 6).setInt8(0, this._type);
        if (isReply) {
            this._sourceTimestamp = sourceTimestamp;
            // - sourceTimestamp
            if (this._sourceTimestamp) new DataView(this._fullMessage, 7).setInt32(0, this._sourceTimestamp);
            // - sequence
            this._sourceSequence = _sourceSequence;
            if (this._sourceSequence) new DataView(this._fullMessage, 11).setInt16(0, this._sourceSequence);
        }
        // set body
        new Uint8Array(this._fullMessage).set(new Uint8Array(this._body), !isReply ? 7 : 13);
    }

    get timestamp(): number { return this._timestamp; }
    get sequence(): number { return this._sequence; }
    get type(): number { return this._type; }
    get sourceTimestamp(): number | undefined { return this._sourceTimestamp; }
    get sourceSequence(): number | undefined { return this._sourceSequence; }
    get body(): ArrayBuffer { return this._body; }
    get fullMessage(): ArrayBuffer { return this._fullMessage; }
    get key(): string { return `${this._timestamp}:${this._sequence}`; }
    get sourceKey(): string { return `${this._sourceTimestamp}:${this._sourceSequence}`; }
    get awaitReply(): boolean { return (this._type === MESSAGE_SEND_AND_LISTEN || this._type === MESSAGE_REPLY_AND_LISTEN); }
    get clockDiff(): number | undefined { return this._clockDiff; }
    set clockDiff(value: number | undefined) { this._clockDiff = value; }
    get timestampToLocalTime(): number | undefined { return this._clockDiff ? this._timestamp + this._clockDiff : undefined; }

}