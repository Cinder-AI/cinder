const DAY_SECONDS = 86_400n;

export const getTimestamp = (event: { block: { time: number } }) => BigInt(event.block.time);
export const getBlockHeight = (event: { block: { height: number } }) => BigInt(event.block.height);
export const getTxId = (event: { transaction: { id: string } }) => event.transaction.id;

export const getDayId = (timestamp: bigint) => (timestamp / DAY_SECONDS).toString();
export const getDayStart = (timestamp: bigint) => (timestamp / DAY_SECONDS) * DAY_SECONDS;
