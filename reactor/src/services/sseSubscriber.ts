import { logger } from "../logger.js";
import type { CampaignUpdatedSseData, SseEvent } from "../types.js";
import { MigrationProcessor } from "./migrationProcessor.js";

function parseSseEvent(block: string): SseEvent | null {
  const lines = block.split("\n");
  let id: string | undefined;
  let event = "message";
  const dataLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("id:")) {
      id = line.slice(3).trim();
      continue;
    }
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (!dataLines.length) {
    return null;
  }

  return {
    id,
    event,
    data: dataLines.join("\n"),
  };
}

export class SseSubscriber {
  private running = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;

  constructor(
    private readonly url: string,
    private readonly migrationProcessor: MigrationProcessor,
  ) {}

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    void this.connectLoop();
  }

  stop(): void {
    this.running = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.running) {
      return;
    }
    const delayMs = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    logger.warn("SSE disconnected, scheduling reconnect", { delayMs, attempt: this.reconnectAttempt });
    this.reconnectTimer = setTimeout(() => {
      void this.connectLoop();
    }, delayMs);
  }

  private async connectLoop(): Promise<void> {
    if (!this.running) {
      return;
    }

    try {
      const response = await fetch(this.url, {
        headers: { Accept: "text/event-stream" },
      });
      if (!response.ok || !response.body) {
        throw new Error(`SSE connect failed: ${response.status} ${response.statusText}`);
      }

      logger.info("Connected to SSE stream", { url: this.url });
      this.reconnectAttempt = 0;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (this.running) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let separatorIndex = buffer.indexOf("\n\n");
        while (separatorIndex !== -1) {
          const rawEvent = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          const parsed = parseSseEvent(rawEvent);
          if (parsed) {
            await this.handleEvent(parsed);
          }
          separatorIndex = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      logger.error("SSE stream failure", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.scheduleReconnect();
  }

  private async handleEvent(event: SseEvent): Promise<void> {
    if (event.event !== "campaign_updated") {
      return;
    }

    try {
      const payload = JSON.parse(event.data) as CampaignUpdatedSseData;
      await this.migrationProcessor.processCampaignSignal(payload, event.id);
    } catch (error) {
      logger.error("Failed to handle campaign_updated SSE event", {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
