export class PeerRecord {
  constructor(
    public username: string,
    public uuid: string,
    public ready: boolean
  ) {}
}

export class RoomRecord {
  constructor(public roomId: string, public peers: PeerRecord[]) {}
}

export class PairingRecord {
  constructor(
    public status: number,
    public uuid1: string,
    public uuid2: string,
    public iceCandidates1: string[],
    public iceCandidates2: string[],
    public offer: string,
    public answer: string
  ) {}
}

export class PairingItem {
  constructor(
    public iceCandidatesDone: string[],
    public answered: boolean,
    public answerVerified: boolean
  ) {}
}
