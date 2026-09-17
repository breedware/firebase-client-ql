import {
  ref,
  onValue,
  Database,
  Unsubscribe,
} from 'firebase/database';

export class FirebaseTimer {
  private db: Database;
  private clockOffset = 0;
  private unsubscribeOffset?: Unsubscribe;

  constructor(realtimeDb: Database) {
    this.db = realtimeDb;

    const offsetRef = ref(this.db, '.info/serverTimeOffset');

    this.unsubscribeOffset = onValue(offsetRef, (snapshot) => {
      this.clockOffset = snapshot.val() || 0;
    });
  }

  /**
   * Returns the current estimated server timestamp in milliseconds.
   */
  getCurrentTimestamp(): number {
    return Date.now() + this.clockOffset;
  }

  /**
   * Returns the current estimated server time as a JavaScript Date object.
   */
  getEstimatedServerTime(): Date {
    return new Date(this.getCurrentTimestamp());
  }

  /**
   * Stop listening for server time offset updates.
   */
  destroy(): void {
    this.unsubscribeOffset?.();
  }
}