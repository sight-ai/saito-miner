import { Logger } from "@nestjs/common";

export class StatusTracker {
  public status: 'online' | 'offline' | 'unknown' = 'unknown';
  constructor(public readonly logger: Logger) {}

  setStatus(status: 'online' | 'offline') {
    if (this.status !== status) {
      
    }
    this.status = status;
  }
}
