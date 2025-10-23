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

    private longestStreak = 0;
    private ended!: boolean;

    constructor() { super("Game"); }

    init() {
        this.ended = false;
        this.timeElapsed = 0;
        this.lives = CONST.LIVES;
        this.scoreState = { score: 0, correct: 0, errors: 0, streak: 0 };
        this.longestStreak = 0;
    }

    create() {
        this.add.image(480, 270, "arena").setAlpha(0.15);
        this.sound.mute = options.mute;
        this.makeHUD();
        this.bindInput();
        this.spawnNextWord(this.getCurrentBucket());
        this.refreshHUD();
    }

    update(_time: number, delta: number) {
        if (this.ended) return;

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
        const { X, Y_STEP, FONT_KEY, HUD_SIZE } = CONST.HUD;
        this.uiScore = this.add.bitmapText(X, 16, FONT_KEY, "Score: 0", HUD_SIZE).setName("score");
        this.uiLives = this.add.bitmapText(X, 16 + Y_STEP, FONT_KEY, `Lives: ${this.lives}`, HUD_SIZE).setName("lives");
        this.uiAccuracy = this.add.bitmapText(X, 16 + Y_STEP * 2, FONT_KEY, "Accuracy: 100%", HUD_SIZE).setName("accuracy");
        this.uiTime = this.add.bitmapText(X, 16 + Y_STEP * 3, FONT_KEY, "Time: 0.0s", HUD_SIZE).setName("time");
    }

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
    }

    private onTypeBad() {
        this.sound.play("type_bad", { volume: CONST.SFX.TYPE_BAD });
        this.scoreState.errors++;
        this.scoreState.streak = 0;
        this.cameras.main.shake(50, 0.002);
    }

    private onWordCompleted() {
        this.sound.play("kill", { volume: CONST.SFX.KILL });
        this.scoreState.score += CONST.SCORE_PER_LETTER * this.currentWord!.word.length;
        this.currentWord!.text.destroy();
        this.currentWord = undefined;

        this.time.delayedCall(80, () => this.spawnNextWord(this.getCurrentBucket()));
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
        this.uiScore.setText(`Score: ${this.scoreState.score}`);
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
}
