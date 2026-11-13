// What the accounts software can answer with that isn't a success.
/** The connection is refused or has expired: nothing more can be sent until the shop reconnects. */
export class ConnectionLost extends Error {
  name = 'ConnectionLost';
  constructor() { super('The connection was refused'); }
}
