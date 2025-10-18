import data from "../data/words_en.json";
import type { RNG } from "./rng";

export type BucketId = "A" | "B" | "C";
export type CurrentWord<TTEXT> = { text: TTEXT; word: string; index: number };
const buckets = new Map<BucketId, string[]>(data.buckets.map((bucket:any) => [bucket.id, bucket.words]));
const blacklist = new Set<string>(data.blacklist || []);

export function pick(bucket: BucketId, rnd: RNG): string {
    const list = buckets.get(bucket) || ["type", "word", "play"];
    let  word = "";
    do { word = list[(rnd() * list.length) | 0] } while (blacklist.has(word));
    return word;
}