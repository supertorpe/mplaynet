export class EventEmitter<T> {
  private _listeners: ((uuid: string, event: T) => void)[] = [];

  constructor() {}

  public addEventListener(listener: (uuid: string, event: T) => void) {
    if (!this._listeners.includes(listener)) {
      this._listeners.push(listener);
    }
  }

  public removeEventListener(listener: (uuid: string, event: T) => void) {
    const idx = this._listeners.indexOf(listener);
    if (idx !== -1) {
      this._listeners.splice(idx, 1);
    }
  }

  public notify(uuid: string, event: T) {
    this._listeners.forEach((_listeners) => {
      _listeners(uuid, event);
    });
  }
}
