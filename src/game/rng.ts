export type RNG = () => number;

export const rng: RNG = () => Math.random();