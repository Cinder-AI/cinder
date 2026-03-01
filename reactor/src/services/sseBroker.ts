/**
 * SSE Broker for managing subscriptions and message broadcasting.
 * Ported from sse-service/app/broker.py
 */

/**
 * Subscriber queue with bounded capacity.
 * Simulates asyncio.Queue with maxsize.
 */
export class SubscriberQueue {
  private messages: string[] = [];
  private maxSize: number;
  private waitingResolvers: Array<((msg: string) => void) | null> = [];

  constructor(maxSize: number = 200) {
    this.maxSize = maxSize;
  }

  /**
   * Push a message into the queue.
   * Returns false if queue is full (message dropped).
   */
  push(msg: string): boolean {
    if (this.messages.length >= this.maxSize) {
      return false; // Queue full, drop message
    }
    this.messages.push(msg);
    // Resolve one waiting consumer if any
    if (this.waitingResolvers.length > 0) {
      const resolver = this.waitingResolvers.shift();
      if (resolver) {
        resolver(msg);
      }
    }
    return true;
  }

  /**
   * Get a message from the queue, waiting if necessary.
   */
  async get(): Promise<string> {
    if (this.messages.length > 0) {
      return this.messages.shift()!;
    }
    return new Promise(resolve => {
      this.waitingResolvers.push(resolve);
    });
  }
}

export class SSEBroker {
  private static _instance: SSEBroker | null = null;
  private _subscriptions: Map<string, Set<SubscriberQueue>> = new Map();

  private constructor() {}

  /**
   * Get singleton instance.
   */
  static instance(): SSEBroker {
    if (!SSEBroker._instance) {
      SSEBroker._instance = new SSEBroker();
    }
    return SSEBroker._instance;
  }

  /**
   * Subscribe a queue to a channel.
   */
  async subscribe(channel: string, queue: SubscriberQueue): Promise<void> {
    if (!this._subscriptions.has(channel)) {
      this._subscriptions.set(channel, new Set());
    }
    this._subscriptions.get(channel)!.add(queue);
  }

  /**
   * Unsubscribe a queue from a channel.
   */
  async unsubscribe(channel: string, queue: SubscriberQueue): Promise<void> {
    const channelSubs = this._subscriptions.get(channel);
    if (channelSubs) {
      channelSubs.delete(queue);
      if (channelSubs.size === 0 && channel !== '*') {
        this._subscriptions.delete(channel);
      }
    }
  }

  /**
   * Publish a message to a specific channel.
   * Returns number of delivered messages.
   */
  async publish(channel: string, message: string): Promise<number> {
    const channelSubs = this._subscriptions.get(channel);
    if (!channelSubs) {
      return 0;
    }
    // Copy to avoid modification during iteration
    const subscribers = Array.from(channelSubs);
    let delivered = 0;
    for (const queue of subscribers) {
      if (queue.push(message)) {
        delivered++;
      }
    }
    return delivered;
  }

  /**
   * Publish to both global ("*") and campaign-specific channel.
   * Returns counts for global and campaign subscribers.
   */
  async publishCampaign(campaignId: string, message: string): Promise<{ global: number; campaign: number }> {
    const sentGlobal = await this.publish('*', message);
    const sentCampaign = await this.publish(campaignId, message);
    return { global: sentGlobal, campaign: sentCampaign };
  }

  /**
   * Get subscription statistics.
   */
  async stats(): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const [channel, queues] of this._subscriptions.entries()) {
      result[channel] = queues.size;
    }
    return result;
  }
}
