import Phaser from "phaser";
import * as CONST from "../game/const";
import { rng as defaultRng } from "../game/rng";
import { pick, type BucketId, type CurrentWord } from "../game/words";
import { updateAccuracy, type ScoreState } from "../game/scoring";
import { options } from "../game/options";

// Simple alias for clarity: one falling word on screen
type EnemyWord = CurrentWord<Phaser.GameObjects.BitmapText>;

// You can move these into CONST later if you like
const ENEMY_SPEED = 20;      // pixels per second (fall speed)
const DANGER_LINE_Y = 500;   // y position of the danger line
const MAX_ENEMIES = 3;       // max words on screen at once

export default class Game extends Phaser.Scene {
    private timeElapsed = 0;
    private scoreState: ScoreState = { score: 0, correct: 0, errors: 0, streak: 0 };
    private rng = defaultRng;

    // MULTI-ENEMY: we now track a list instead of a single currentWord
    private enemies: EnemyWord[] = [];

    private lockedEnemy?: EnemyWord;
    private lockedUnderline?: Phaser.GameObjects.Rectangle;

    private uiScore!: Phaser.GameObjects.BitmapText;
    private uiAccuracy!: Phaser.GameObjects.BitmapText;
    private uiTime!: Phaser.GameObjects.BitmapText;
    private uiMuteIcon?: Phaser.GameObjects.Image;
    private uiPowerFill!: Phaser.GameObjects.Rectangle;
    private uiPowerBg!: Phaser.GameObjects.Rectangle;
    private uiPowerHint?: Phaser.GameObjects.BitmapText;
    private powerHintTween?: Phaser.Tweens.Tween;

    private longestStreak = 0;
    private ended = false;

    private power = 0;
    private powerReady = false;

    private damageOverlay!: Phaser.GameObjects.Rectangle;
    private errorLockMs = 0;

    private bgm?: Phaser.Sound.BaseSound;

    // techno background reference (not strictly needed, but we keep it)
    private techBg!: Phaser.GameObjects.Image;

    constructor() { super("Game"); }

    init() {
        this.ended = false;
        this.timeElapsed = 0;
        this.scoreState = { score: 0, correct: 0, errors: 0, streak: 0 };
        this.longestStreak = 0;
        this.power = 0;
        this.powerReady = false;
        this.errorLockMs = 0;
        this.enemies = [];
        this.lockedEnemy = undefined;
        this.lockedUnderline = undefined;
    }

    create() {
        // Background
        this.createTechBackground();

        // Danger line so the player sees the "death" boundary
        this.add
            .rectangle(480, DANGER_LINE_Y, 960, 2, 0xff4444, 0.8)
            .setDepth(-1);

        // Audio (global mute + bgm)
        this.sound.mute = options.mute;
        this.bgm = this.sound.add("bgm_main", {
            loop: true,
            volume: 0.4, // tweak to taste
        });
        if (!this.sound.mute) {
            this.bgm.play();
        }

        // HUD & UI
        this.makeHUD();
        this.updateMuteIcon();
        this.bindInput();

        // First enemy + spawn loop
        this.spawnNextWord(this.getCurrentBucket());
        this.scheduleNextSpawn();

        this.refreshHUD();

        // Damage overlay
        this.damageOverlay = this.add
            .rectangle(480, 270, 960, 540, 0xff0000, 1)
            .setAlpha(0)
            .setDepth(10);
    }

    update(_time: number, delta: number) {
        if (this.ended) return;

        const dt = delta / 1000;

        if (this.errorLockMs > 0) {
            this.errorLockMs = Math.max(0, this.errorLockMs - delta);
        }

        this.timeElapsed += dt;

        // Move enemies downward
        for (const enemy of this.enemies) {
            enemy.text.y += ENEMY_SPEED * dt;
        }

        if (this.lockedEnemy && this.lockedUnderline) {
            const t = this.lockedEnemy.text;
            this.lockedUnderline.setPosition(t.x, t.y + t.height * 0.6);
            this.lockedUnderline.width = t.width;
        }

        // Check if any crossed the danger line → instant game over
        for (const enemy of this.enemies) {
            if (enemy.text.y >= DANGER_LINE_Y) {
                this.handleDangerCross(enemy);
                break;
            }
        }
    }

    shutdown() {
        this.input.keyboard?.removeAllListeners();
    }

    // ─────────────────────────────────────────
    // HUD & power bar
    // ─────────────────────────────────────────

    private makeHUD() {
        const {
            X,
            Y_STEP,
            FONT_KEY,
            HUD_SIZE,
            POWER_BAR_X,
            POWER_BAR_Y,
            POWER_BAR_WIDTH,
            POWER_BAR_HEIGHT,
        } = CONST.HUD;

        this.uiScore = this.add
            .bitmapText(X, 16, FONT_KEY, "Score: 0", HUD_SIZE)
            .setName("score");

        this.uiAccuracy = this.add
            .bitmapText(X, 16 + Y_STEP * 2, FONT_KEY, "Accuracy: 100%", HUD_SIZE)
            .setName("accuracy");

        this.uiPowerBg = this.add
            .rectangle(POWER_BAR_X, POWER_BAR_Y, POWER_BAR_WIDTH, POWER_BAR_HEIGHT, 0x22262e)
            .setOrigin(1, 0);

        this.uiPowerFill = this.add
            .rectangle(POWER_BAR_X - POWER_BAR_WIDTH, POWER_BAR_Y, 0, POWER_BAR_HEIGHT, 0x49d78a)
            .setOrigin(0, 0);

        this.uiPowerHint = this.add
            .bitmapText(
                POWER_BAR_X - POWER_BAR_WIDTH,
                POWER_BAR_Y + POWER_BAR_HEIGHT + 10,
                FONT_KEY,
                "[SPACE] BLAST",
                HUD_SIZE - 4
            )
            .setOrigin(0, 0)
            .setAlpha(0); // hidden until ready
    }

    private setPower(v: number) {
        const capped = Math.max(0, Math.min(CONST.POWER.MAX, v));
        this.power = capped;
        const pct = capped / CONST.POWER.MAX; // 0..1
        const w = 160 * pct;

        this.uiPowerFill.width = w;
        this.uiPowerFill.fillColor =
            pct >= CONST.POWER.THRESHOLD / CONST.POWER.MAX ? 0xffd54d : 0x49d78a;

        const wasReady = this.powerReady;
        this.powerReady = capped >= CONST.POWER.THRESHOLD;

        // NEW: update hint visibility / tween
        if (this.uiPowerHint) {
            if (this.powerReady) {
                this.uiPowerHint.setAlpha(1).setTint(0xffd54d);
                if (!this.powerHintTween) {
                    this.powerHintTween = this.tweens.add({
                        targets: this.uiPowerHint,
                        scale: 1.05,
                        yoyo: true,
                        repeat: -1,
                        duration: 450,
                        ease: "Sine.easeInOut",
                    });
                }
            } else {
                this.uiPowerHint.setAlpha(0).setScale(1).clearTint();
                if (this.powerHintTween) {
                    this.powerHintTween.stop();
                    this.powerHintTween = undefined;
                }
            }
        }
    }


    private addPower(delta: number) {
        this.setPower(this.power + delta);
    }

    private refreshHUD() {
        const acc = updateAccuracy(this.scoreState);
        this.uiScore.setText(`Score: ${this.scoreState.score.toLocaleString()}`);
        this.uiAccuracy.setText("Accuracy: " + Math.round(acc * 100) + "%");
    }

    public updateMuteIcon() {
        if (options.mute) {
            if (!this.uiMuteIcon) {
                this.uiMuteIcon = this.add
                    .image(750, 500, "ui_muted")
                    .setOrigin(1, 0)
                    .setScrollFactor(0)
                    .setAlpha(0.85)
                    .setDepth(20)
                    .setScale(0.1);
            }
        } else {
            this.uiMuteIcon?.destroy();
            this.uiMuteIcon = undefined;
        }
    }

    // ─────────────────────────────────────────
    // Input & typing logic (multi-enemy)
    // ─────────────────────────────────────────

    private bindInput() {
        this.input.keyboard?.on("keydown-ESC", () => {
            if (this.ended) return;
            this.scene.pause();
            this.scene.launch("Pause");
        });

        this.input.keyboard?.on("keydown-SPACE", () => {
            if (this.ended) return;
            if (this.powerReady) {
                this.triggerPowerBlast();
            }
        });

        this.input.keyboard?.on("keydown", (ev: KeyboardEvent) => {
            if (ev.repeat) return;
            const ch = ev.key;
            if (!/^[a-z]$/.test(ch)) return;
            this.onChar(ch.toLowerCase());
        });
    }

    private onChar(ch: string) {
        if (this.enemies.length === 0) return;

        if (this.lockedEnemy) {
            const enemy = this.lockedEnemy;
            const expected = enemy.word[enemy.index];

            if (ch === expected) {
                this.onTypeOk(enemy);
            } else {
                this.onTypeBad();
            }
        } else {
            const target = this.findTargetEnemy(ch);
            if (target) {
                // First correct letter on some word → lock onto it
                this.setLockedEnemy(target);
                this.onTypeOk(target);
            } else {
                this.onTypeBad();
            }
        }

        this.refreshHUD();
    }


    // pick the enemy whose next letter matches and is closest to the danger line
    private findTargetEnemy(ch: string): EnemyWord | undefined {
        let best: EnemyWord | undefined;
        let bestY = -Infinity;

        for (const enemy of this.enemies) {
            if (enemy.word[enemy.index] === ch) {
                if (enemy.text.y > bestY) {
                    bestY = enemy.text.y;
                    best = enemy;
                }
            }
        }
        return best;
    }

    private getClosestEnemy(): EnemyWord | undefined {
        let best: EnemyWord | undefined;
        let bestY = -Infinity;

        for (const enemy of this.enemies) {
            if (enemy.text.y > bestY) {
                bestY = enemy.text.y;
                best = enemy;
            }
        }
        return best;
    }

    private onTypeOk(enemy: EnemyWord) {
        this.sound.play("type_ok", { volume: CONST.SFX.TYPE_OK });

        enemy.index++;
        this.scoreState.correct++;
        this.scoreState.streak++;
        if (this.scoreState.streak > this.longestStreak) {
            this.longestStreak = this.scoreState.streak;
        }

        enemy.text.setText(
            enemy.word.slice(0, enemy.index).toUpperCase() +
            enemy.word.slice(enemy.index)
        );

        if (enemy.index >= enemy.word.length) {
            this.onWordCompleted(enemy);
        }

        this.addPower(CONST.POWER.PER_LETTER);
    }

    private onTypeBad() {
        if (this.errorLockMs > 0) {
            this.scoreState.errors++;
            this.scoreState.streak = 0;
            this.addPower(-CONST.POWER.MISS_PENALTY);
            return;
        }

        this.errorLockMs = 120;

        this.sound.play("type_bad", { volume: CONST.SFX.TYPE_BAD });
        this.scoreState.errors++;
        this.scoreState.streak = 0;
        this.addPower(-CONST.POWER.MISS_PENALTY);

        this.cameras.main.shake(120, 0.004);

        this.damageOverlay.setAlpha(0.45);
        this.tweens.killTweensOf(this.damageOverlay);
        this.tweens.add({
            targets: this.damageOverlay,
            alpha: 0,
            duration: 140,
            ease: "Quad.easeOut",
        });

        // squash & stretch the enemy closest to danger line (if any)
        const target = this.lockedEnemy ?? this.getClosestEnemy();
        if (target) {
            const t = target.text;
            this.tweens.killTweensOf(t);
            t.setScale(1);
            this.tweens.add({
                targets: t,
                scaleX: 1.12,
                scaleY: 0.88,
                yoyo: true,
                duration: 80,
                ease: "Quad.easeOut",
            });
        }
    }

    private onWordCompleted(enemy: EnemyWord) {
        this.sound.play("kill", { volume: CONST.SFX.KILL });

        this.scoreState.score += CONST.SCORE_PER_LETTER * enemy.word.length;

        // remove this enemy
        enemy.text.destroy();
        const idx = this.enemies.indexOf(enemy);
        if (idx >= 0) {
            this.enemies.splice(idx, 1);
        }

        if (this.lockedEnemy === enemy) {
            this.setLockedEnemy(undefined);
        }

        this.addPower(CONST.POWER.PER_WORD);
    }

    // ─────────────────────────────────────────
    // Spawning & danger
    // ─────────────────────────────────────────

    private spawnNextWord(bucket: BucketId) {
        if (this.enemies.length >= MAX_ENEMIES) return;

        const word = pick(bucket, this.rng);
        const y = 60;

        // Create the text first so we know its width
        const txt = this.add
            .bitmapText(0, y, CONST.HUD.FONT_KEY, word, 36)
            .setOrigin(0.5);

        const screenWidth = this.scale.width;
        const halfWidth = txt.width / 2;
        const margin = 32;

        const minX = halfWidth + margin;
        const maxX = screenWidth - halfWidth - margin;

        const maxAttempts = 20;
        let chosenX = Phaser.Math.Between(Math.floor(minX), Math.floor(maxX));

        // Try to find a non-overlapping position
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const x = Phaser.Math.Between(Math.floor(minX), Math.floor(maxX));

            const overlaps = this.enemies.some((e) => {
                const dx = Math.abs(e.text.x - x);
                const minDist = (e.text.width + txt.width) / 2 + margin;
                return dx < minDist;
            });

            if (!overlaps) {
                chosenX = x;
                break;
            }
        }

        txt.setX(chosenX);

        this.enemies.push({ text: txt, word, index: 0 });
    }

    // keep spawning new enemies over time, regardless of kills
    private scheduleNextSpawn() {
        const delay = this.respawnDelayMS();
        this.time.delayedCall(delay, () => {
            if (this.ended) return;
            this.spawnNextWord(this.getCurrentBucket());
            this.scheduleNextSpawn();
        });
    }

    private handleDangerCross(_enemy: EnemyWord) {
        // you could add extra fx here if you want
        this.cameras.main.flash(200, 255, 0, 0);
        this.endRun();
    }

    private getCurrentBucket(): BucketId {
        const [b1, b2] = CONST.GAME.TIER_BOUNDS;
        if (this.timeElapsed < b1) return "A";
        if (this.timeElapsed < b2) return "B";
        return "C";
    }

    // ─────────────────────────────────────────
    // End / pacing / power blast
    // ─────────────────────────────────────────

    private endRun() {
        if (this.ended) return;
        this.ended = true;

        const accuracy = updateAccuracy(this.scoreState);

        this.setLockedEnemy(undefined);

        // stop bgm
        if (this.bgm) {
            this.bgm.stop();
        }

        // clean up enemies
        for (const e of this.enemies) {
            e.text.destroy();
        }
        this.enemies = [];

        this.scene.start("Results", {
            score: this.scoreState.score,
            accuracy,
            longestStreak: this.longestStreak,
        });
    }

    private respawnDelayMS(): number {
        const t = Math.min(this.timeElapsed, CONST.RESPAWN.RAMP_SEC) / CONST.RESPAWN.RAMP_SEC;
        const ease = 1 - Math.pow(1 - t, 2);
        let base =
            CONST.RESPAWN.START_MS + (CONST.RESPAWN.END_MS - CONST.RESPAWN.START_MS) * ease;

        const bonus = Math.min(this.scoreState.streak, 50) / 50;
        base -= 60 * bonus;

        if (CONST.RESPAWN.JITTER_MS) {
            base += (Math.random() * 2 - 1) * CONST.RESPAWN.JITTER_MS;
        }
        return Math.max(0, Math.round(base));
    }

    private triggerPowerBlast() {
        // consume the charge
        this.setPower(0);

        this.setLockedEnemy(undefined);

        // juice: white flash + slight slowmo
        this.cameras.main.flash(120, 255, 255, 255);
        this.time.timeScale = 0.9;
        this.time.delayedCall(200, () => {
            this.time.timeScale = 1;
        });

        // NEW: blast kills all words on screen and gives score for them
        for (const enemy of this.enemies) {
            this.scoreState.score += CONST.SCORE_PER_LETTER * enemy.word.length;
            enemy.text.destroy();
        }
        this.enemies = [];

        // flat bonus (keep if you like)
        this.scoreState.score += 100;

        this.refreshHUD();
        // sfx hook: this.sound.play("blast", { volume: ... }) when you add one
    }

    private setLockedEnemy(enemy?: EnemyWord) {
        // no change
        if (this.lockedEnemy === enemy) return;

        // Clear previous highlight
        if (this.lockedEnemy) {
            this.lockedEnemy.text.clearTint();
        }
        if (this.lockedUnderline) {
            this.lockedUnderline.destroy();
            this.lockedUnderline = undefined;
        }

        this.lockedEnemy = enemy;

        // Set new highlight
        if (enemy) {
            enemy.text.setTint(0xffd54d); // gold-ish

            const t = enemy.text;
            this.lockedUnderline = this.add.rectangle(
                t.x,
                t.y + t.height * 0.6,
                t.width,
                4,
                0xffd54d,
                0.8
            );
            this.lockedUnderline.setOrigin(0.5, 0.5);
            this.lockedUnderline.setDepth(t.depth + 0.1);
        }
    }


    // ─────────────────────────────────────────
    // Techno background + ripple
    // ─────────────────────────────────────────

    private createTechBackground() {
        const w = this.scale.width;
        const h = this.scale.height;
        const cx = w / 2;
        const cy = h / 2;

        const g = this.add.graphics();

        // Dark base
        g.fillStyle(0x050510, 1);
        g.fillRect(0, 0, w, h);

        // Radial neon-ish rings
        const maxRadius = Math.max(w, h) * 0.7;
        for (let r = maxRadius; r > 0; r -= 8) {
            const alpha = Phaser.Math.Linear(0.0, 0.6, r / maxRadius);
            g.lineStyle(2, 0x00ffff, alpha * 0.3);
            g.strokeCircle(cx, cy, r);
        }

        // Grid
        const cell = 40;
        g.lineStyle(1, 0x00ffff, 0.15);
        for (let x = 0; x <= w; x += cell) {
            g.lineBetween(x, 0, x, h);
        }
        for (let y = 0; y <= h; y += cell) {
            g.lineBetween(0, y, w, y);
        }

        // Diagonal scan-ish lines
        g.lineStyle(1, 0x00ffff, 0.12);
        for (let x = -h; x < w; x += cell * 2) {
            g.lineBetween(x, 0, x + h, h);
        }

        // Bake into a texture and remove Graphics
        g.generateTexture("tech-bg", w, h);
        g.destroy();

        this.techBg = this.add.image(cx, cy, "tech-bg");
        this.techBg
            .setScrollFactor(0)
            .setDepth(-10) // behind everything
            .setScale(1.1);

        // Subtle animated rotation
        this.tweens.add({
            targets: this.techBg,
            angle: 4,
            duration: 8000,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        // Subtle breathing scale
        this.tweens.add({
            targets: this.techBg,
            scale: 1.15,
            duration: 6000,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        // Center ripple pulse
        this.time.addEvent({
            delay: 900,
            loop: true,
            callback: () => this.spawnRipple(cx, cy),
        });
    }

    private spawnRipple(x: number, y: number) {
        const g = this.add.graphics({ x, y });
        g.setDepth(-5); // above background, below gameplay/UI

        g.lineStyle(2, 0x00ffff, 0.7);
        g.strokeCircle(0, 0, 0);

        this.tweens.add({
            targets: g,
            scaleX: { from: 0, to: 1.2 },
            scaleY: { from: 0, to: 1.2 },
            alpha: { from: 0.8, to: 0 },
            duration: 1200,
            ease: "Sine.easeOut",
            onComplete: () => g.destroy(),
        });
    }
}
