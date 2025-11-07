export const LIVES = 3;
export const SCORE_PER_LETTER = 1000;

export const GAME = {
    DURATION_SEC: 15,
    END_ON_STREAK: 0,
    TIER_BOUNDS: [20, 40],
};

export const SFX = {
    TYPE_OK: 0.35,
    TYPE_BAD: 0.4,
    KILL: 0.4,
};

export const HUD = {
    X: 16,
    Y_STEP: 32,
    FONT_KEY: "bm",
    HUD_SIZE: 24,
    POWER_BAR_X: 500,
    POWER_BAR_Y: 16,
    POWER_BAR_WIDTH: 160,
    POWER_BAR_HEIGHT: 15,
};

export const RESPAWN = {
    START_MS: 420,
    END_MS: 120,
    RAMP_SEC: 60,
    JITTER_MS:40,
}

export const POWER = {
    MAX: 100,
    THRESHOLD: 100,
    PER_LETTER: 2,
    PER_WORD: 6,
    MISS_PENALTY: 12,
}