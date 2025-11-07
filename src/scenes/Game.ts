import Phaser from "phaser";
import * as CONST from "../game/const";
import { rng as defaultRng } from "../game/rng";
import { pick, type BucketId, type CurrentWord } from "../game/words";
import { updateAccuracy, type ScoreState } from "../game/scoring";
import { options } from "../game/options";

export default class Game extends Phaser.Scene {
    private lives = CONST.LIVES;
    private timeElapsed = 0;
    private scoreState: ScoreState = { score: 0, correct: 0, errors: 0, streak: 0 };
    private rng = defaultRng;

    private currentWord?: CurrentWord<Phaser.GameObjects.BitmapText>;

    private uiScore!: Phaser.GameObjects.BitmapText;
    private uiLives!: Phaser.GameObjects.BitmapText
    private uiAccuracy!: Phaser.GameObjects.BitmapText;
    private uiTime!: Phaser.GameObjects.BitmapText;
    private uiMuteIcon?: Phaser.GameObjects.Image;
    private uiPowerFill!: Phaser.GameObjects.Rectangle;
    private uiPowerBg!: Phaser.GameObjects.Rectangle;

    private longestStreak = 0;
    private ended!: boolean;

    private power = 0;
    private powerReady = false;

    private damageOverlay!: Phaser.GameObjects.Rectangle;
    private errorLockMs = 0;

    constructor() { super("Game"); }

    init() {
        this.ended = false;
        this.timeElapsed = 0;
        this.lives = CONST.LIVES;
        this.scoreState = { score: 0, correct: 0, errors: 0, streak: 0 };
        this.longestStreak = 0;
        this.power = 0;
        this.powerReady = false;
    }

    create() {
        this.add.image(480, 270, "arena").setAlpha(0.15);
        this.sound.mute = options.mute;
        this.makeHUD();
        this.updateMuteIcon()
        this.bindInput();
        this.spawnNextWord(this.getCurrentBucket());
        this.refreshHUD();

        this.damageOverlay = this.add.rectangle(480, 270, 960, 540, 0xff0000, 1).setAlpha(0).setDepth(10);
    }

    update(_time: number, delta: number) {
        if (this.ended) return;

        if (this.errorLockMs > 0) {
            this.errorLockMs = Math.max(0, this.errorLockMs - delta);
        }

        this.timeElapsed += delta / 1000;
        this.uiTime.setText(`Time: ${this.timeElapsed.toFixed(1)}s`);

        if (CONST.GAME.DURATION_SEC > 0 && this.timeElapsed >= CONST.GAME.DURATION_SEC) {
            this.endRun();
            return;
        }
        if (CONST.GAME.END_ON_STREAK > 0 && this.scoreState.streak >= CONST.GAME.END_ON_STREAK) {
            this.endRun();
            return;
        }
    }

    shutdown() {
        this.input.keyboard?.removeAllListeners();
    }

    private makeHUD() {
        const { X, Y_STEP, FONT_KEY, HUD_SIZE, POWER_BAR_X, POWER_BAR_Y, POWER_BAR_WIDTH, POWER_BAR_HEIGHT } = CONST.HUD;
        this.uiScore = this.add.bitmapText(X, 16, FONT_KEY, "Score: 0", HUD_SIZE).setName("score");
        this.uiLives = this.add.bitmapText(X, 16 + Y_STEP, FONT_KEY, `Lives: ${this.lives}`, HUD_SIZE).setName("lives");
        this.uiAccuracy = this.add.bitmapText(X, 16 + Y_STEP * 2, FONT_KEY, "Accuracy: 100%", HUD_SIZE).setName("accuracy");
        this.uiTime = this.add.bitmapText(X, 16 + Y_STEP * 3, FONT_KEY, "Time: 0.0s", HUD_SIZE).setName("time");
        this.uiPowerBg = this.add.rectangle(POWER_BAR_X, POWER_BAR_Y, POWER_BAR_WIDTH, POWER_BAR_HEIGHT, 0x22262e).setOrigin(1, 0);
        this.uiPowerFill = this.add.rectangle(POWER_BAR_X - POWER_BAR_WIDTH, POWER_BAR_Y, 0, POWER_BAR_HEIGHT, 0x49d78a).setOrigin(0, 0);
    }

    private setPower(v: number) {
        const capped = Math.max(0, Math.min(CONST.POWER.MAX, v));
        this.power = capped;
        const pct = capped / CONST.POWER.MAX; // 0..1
        const w = 160 * pct;
        this.uiPowerFill.width = w;
        // green → gold when ready
        this.uiPowerFill.fillColor = (pct >= CONST.POWER.THRESHOLD / CONST.POWER.MAX) ? 0xffd54d : 0x49d78a;
        this.powerReady = (capped >= CONST.POWER.THRESHOLD);
    }

    private addPower(delta: number) { this.setPower(this.power + delta); }


    private bindInput() {
        this.input.keyboard?.on("keydown-ESC", () => {
            if (this.ended) return;
            this.scene.pause();
            this.scene.launch("Pause");
        });
        this.input.keyboard?.on("keydown", (ev: KeyboardEvent) => {
            if (ev.repeat) return;
            const ch = ev.key;
            if (!/^[a-z]$/.test(ch)) return;
            if (!this.currentWord) return;
            this.onChar(ch.toLowerCase());
        });
    }

    private onChar(ch: string) {
        const cw = this.currentWord!;
        const expected = cw.word[cw.index];

        if (ch === expected) this.onTypeOk(cw);
        else this.onTypeBad();
        this.refreshHUD();
    }

    private onTypeOk(currentWord: CurrentWord<Phaser.GameObjects.BitmapText>) {
        this.sound.play("type_ok", { volume: CONST.SFX.TYPE_OK });
        currentWord.index++;
        this.scoreState.correct++;
        this.scoreState.streak++;
        if (this.scoreState.streak > this.longestStreak) this.longestStreak = this.scoreState.streak;

        currentWord.text.setText(
            currentWord.word.slice(0, currentWord.index).toUpperCase() +
            currentWord.word.slice(currentWord.index)
        );

        if (currentWord.index >= currentWord.word.length) this.onWordCompleted();

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
            ease: "Quad.easeOut"
        });

        if (this.currentWord) {
            const t = this.currentWord.text;
            this.tweens.killTweensOf(t);
            t.setScale(1);
            this.tweens.add({
                targets: t,
                scaleX: 1.12,
                scaleY: 0.88,
                yoyo: true,
                duration: 80,
                ease: "Quad.easeOut"
            });
        }
    }

    private onWordCompleted() {
        this.sound.play("kill", { volume: CONST.SFX.KILL });
        this.scoreState.score += CONST.SCORE_PER_LETTER * this.currentWord!.word.length;
        this.currentWord!.text.destroy();
        this.currentWord = undefined;
        this.addPower(CONST.POWER.PER_WORD);
        if (this.powerReady) {
            this.triggerPowerBlast(); // placeholder (single-word era)
        }
        this.time.delayedCall(this.respawnDelayMS(), () => this.spawnNextWord(this.getCurrentBucket()));
    }

    private spawnNextWord(bucket: BucketId) {
        const word = pick(bucket, this.rng);
        const txt = this.add.bitmapText(480, 270, CONST.HUD.FONT_KEY, word, 36).setOrigin(0.5);
        this.currentWord = { text: txt, word, index: 0 };
    }

    private getCurrentBucket(): BucketId {
        const [b1, b2] = CONST.GAME.TIER_BOUNDS;
        if (this.timeElapsed < b1) return "A";
        if (this.timeElapsed < b2) return "B";
        return "C";
    }

    private refreshHUD() {
        const acc = updateAccuracy(this.scoreState);
        this.uiScore.setText(`Score: ${this.scoreState.score.toLocaleString()}`);
        this.uiAccuracy.setText("Accuracy: " + Math.round(acc * 100) + "%");
        this.uiLives.setText(`Lives: ${this.lives}`);
    }

    private endRun() {
        if (this.ended) return;
        this.ended = true;

        const accuracy = updateAccuracy(this.scoreState);
        this.scene.start("Results", {
            score: this.scoreState.score,
            accuracy,
            longestStreak: this.longestStreak
        });
    }

    private respawnDelayMS(): number {
        const t = Math.min(this.timeElapsed, CONST.RESPAWN.RAMP_SEC) / CONST.RESPAWN.RAMP_SEC;
        const ease = 1 - Math.pow(1 - t, 2);
        let base = CONST.RESPAWN.START_MS + (CONST.RESPAWN.END_MS - CONST.RESPAWN.START_MS) * ease;

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

        // juice: white flash + slight slowmo
        this.cameras.main.flash(120, 255, 255, 255);
        this.time.timeScale = 0.9;
        this.time.delayedCall(200, () => { this.time.timeScale = 1; });

        // reward: flat bonus (tune later)
        this.scoreState.score += 100;

        // sfx
        // safePlay(this, "blast", {...}) // later, when you add a blast sound

        // ready resets automatically because power=0
    }

    public updateMuteIcon() {
        if (options.mute) {
            if (!this.uiMuteIcon) {
                this.uiMuteIcon = this.add.image(750, 500, "ui_muted")
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
}
