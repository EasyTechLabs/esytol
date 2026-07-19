/**
 * Event bus (AIOS-004) — the mediated messaging fabric (EventBus.md / InterAgentCommunication.md).
 *
 * Components never call each other directly; they publish and subscribe to typed, immutable events.
 * Delivery is deterministic (subscribers are notified in registration order); a handler that throws
 * sends the event to the dead-letter queue rather than losing it. Priority is carried on every event
 * and honoured by the future Scheduler; this in-memory bus delivers synchronously for the orchestrator.
 */

import type { Clock, IdGenerator } from "./kernel";
import type { EventEnvelope, Priority, TrustLevel, PlainData } from "./types";

export type EventHandler = (event: EventEnvelope) => void;

interface Subscription {
  /** Event type to match, or "*" for all. */
  type: string;
  handler: EventHandler;
}

export interface DeadLetteredEvent {
  event: EventEnvelope;
  reason: string;
  at: number;
}

export interface PublishInput {
  type: string;
  source: string;
  correlationId: string;
  causationId?: string;
  subject?: string;
  priority?: Priority;
  trustLevel?: TrustLevel;
  payload?: PlainData;
  version?: string;
}

export class EventBus {
  private subscriptions: Subscription[] = [];
  private published: EventEnvelope[] = [];
  private dlq: DeadLetteredEvent[] = [];

  constructor(
    private readonly clock: Clock,
    private readonly ids: IdGenerator
  ) {}

  subscribe(type: string, handler: EventHandler): () => void {
    const sub: Subscription = { type, handler };
    this.subscriptions.push(sub);
    return () => {
      this.subscriptions = this.subscriptions.filter((s) => s !== sub);
    };
  }

  /** Build a well-formed, immutable event and deliver it to matching subscribers. */
  publish(input: PublishInput): EventEnvelope {
    const event: EventEnvelope = Object.freeze({
      messageId: this.ids.next("evt"),
      type: input.type,
      version: input.version ?? "1.0",
      correlationId: input.correlationId,
      ...(input.causationId ? { causationId: input.causationId } : {}),
      source: input.source,
      ...(input.subject ? { subject: input.subject } : {}),
      priority: input.priority ?? "P2",
      trustLevel: input.trustLevel ?? "trusted",
      timestamp: this.clock.now(),
      payload: input.payload ? Object.freeze({ ...input.payload }) : {},
    });
    this.published.push(event);

    for (const sub of this.subscriptions) {
      if (sub.type !== "*" && sub.type !== event.type) continue;
      try {
        sub.handler(event);
      } catch (err) {
        this.dlq.push({
          event,
          reason: err instanceof Error ? err.message : "handler error",
          at: this.clock.now(),
        });
      }
    }
    return event;
  }

  publishedEvents(): readonly EventEnvelope[] {
    return this.published;
  }

  deadLetterQueue(): readonly DeadLetteredEvent[] {
    return this.dlq;
  }
}
