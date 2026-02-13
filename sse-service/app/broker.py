import asyncio


class SSEBroker:
    """Singleton broker for global and campaign-specific SSE subscriptions."""

    _instance: "SSEBroker | None" = None

    def __init__(self) -> None:
        self._subscriptions: dict[str, set[asyncio.Queue[str]]] = {"*": set()}
        self._lock = asyncio.Lock()

    @classmethod
    def instance(cls) -> "SSEBroker":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def subscribe(self, channel: str, queue: asyncio.Queue[str]) -> None:
        async with self._lock:
            self._subscriptions.setdefault(channel, set()).add(queue)

    async def unsubscribe(self, channel: str, queue: asyncio.Queue[str]) -> None:
        async with self._lock:
            if channel in self._subscriptions:
                self._subscriptions[channel].discard(queue)
                if channel != "*" and not self._subscriptions[channel]:
                    del self._subscriptions[channel]

    async def publish(self, channel: str, message: str) -> int:
        async with self._lock:
            subscribers = list(self._subscriptions.get(channel, set()))

        delivered = 0
        for queue in subscribers:
            try:
                queue.put_nowait(message)
                delivered += 1
            except asyncio.QueueFull:
                # Slow consumer: skip this event for that subscriber.
                pass
        return delivered

    async def publish_campaign(self, campaign_id: str, message: str) -> dict[str, int]:
        sent_global = await self.publish("*", message)
        sent_campaign = await self.publish(campaign_id, message)
        return {"global": sent_global, "campaign": sent_campaign}

    async def stats(self) -> dict[str, int]:
        async with self._lock:
            return {channel: len(queues) for channel, queues in self._subscriptions.items()}
