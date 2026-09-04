/**
 * What each narration channel has said lately, so it is not said again.
 * `depth` is how many lines back a channel refuses to repeat; `exhausted` is
 * what it does when a pool holds nothing unsaid.
 */

export type Ledger = Readonly<Record<string, readonly string[]>>;

export const EMPTY_LEDGER: Ledger = {};

interface Channel {
  /** Lines back this channel will not repeat. `Infinity` is the whole run. */
  depth: number;
  /** Behaviour when the pool holds nothing unsaid. */
  exhausted: "repeat" | "silent";
}

/**
 * Keyed by the name before any `:`, so `band:tragedy` and `band:dread.0` are
 * separate memories configured once. Anything unlisted remembers one line.
 */
const CHANNELS: Record<string, Channel> = {
  ambient: { depth: 1, exhausted: "repeat" },
  band: { depth: 3, exhausted: "repeat" },
  below: { depth: Infinity, exhausted: "silent" }
};

const DEFAULT: Channel = { depth: 1, exhausted: "repeat" };

const configOf = (channel: string): Channel =>
  CHANNELS[channel.split(":")[0]!] ?? DEFAULT;

export const saidLately = (
  ledger: Ledger,
  channel: string,
  text: string
): boolean => (ledger[channel] ?? []).includes(text);

/** Records `text`, trimming the channel to its depth. */
export function record(ledger: Ledger, channel: string, text: string): Ledger {
  const { depth } = configOf(channel);
  const kept = [text, ...(ledger[channel] ?? []).filter((t) => t !== text)];
  return {
    ...ledger,
    [channel]: depth === Infinity ? kept : kept.slice(0, depth)
  };
}

/**
 * A line this channel has not said lately. `undefined` when the pool is spent
 * and the channel is `silent`. `roll` is consumed only when a line is returned.
 */
export function choose(
  ledger: Ledger,
  channel: string,
  pool: readonly string[],
  roll: () => number
): { ledger: Ledger; line: string } | undefined {
  const fresh = pool.filter((line) => !saidLately(ledger, channel, line));
  const from =
    fresh.length > 0 ? fresh : configOf(channel).exhausted === "repeat" ? pool : [];
  if (from.length === 0) return undefined;
  const line = from[Math.floor(roll() * from.length)]!;
  return { ledger: record(ledger, channel, line), line };
}

/** Which of `texts` this channel has not said. Records as it goes. */
export function filter(
  ledger: Ledger,
  channel: string,
  texts: readonly string[]
): { ledger: Ledger; keep: boolean[] } {
  let next = ledger;
  const keep = texts.map((text) => {
    if (saidLately(next, channel, text)) return false;
    next = record(next, channel, text);
    return true;
  });
  return { ledger: next, keep };
}
