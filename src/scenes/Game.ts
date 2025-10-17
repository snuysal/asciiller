import Phaser from "phaser";
import * as CONST from "../game/const";
import { rng as defaultRng } from "../game/rng";
import { pick } from "../game/words";
import { updateAccuracy, type ScoreState } from "../game/scoring";

export default class Game extends Phaser.Scene {
    private lives = CONST.LIVES;
    private timeElapsed = 0;
    private scoreState: ScoreState = { score: 0, correct: 0, errors: 0, streak: 0 };
    private rng = defaultRng;
    private currentWord?: { text: Phaser.GameObjects.BitmapText, word: string, index: number };

    constructor() { super("Game");}

    create() {
        this.add.image(480, 270, "arena").setAlpha(0.15);
        this.add.bitmapText(16, 16, "bm", "Score: 0", 24).setName("score");
        this.add.bitmapText(16, 48, "bm", `Lives: ${this.lives}`, 24).setName("lives");
        this.add.bitmapText(16, 80, "bm", "Accuracy: 100%", 24).setName("accuracy");

        const word = pick("A", this.rng);
        const txt = this.add.bitmapText(480, 270, "bm", word, 36).setOrigin(0.5);
        this.currentWord = { text: txt, word, index: 0 };

        this.input.keyboard?.on("keydown", (ev: KeyboardEvent) => {
            const ch = ev.key.toLowerCase();
            if (!/^[a-z]$/.test(ch)) return
            if (!this.currentWord) return

            const expected = this.currentWord.word[this.currentWord.index];
            if (ch === expected) {
                this.sound.play("type_ok", { volume: 0.4 });
                this.currentWord.index++;
                this.scoreState.correct++;
                this.scoreState.streak++;
                this.currentWord.text.setText(
                    this.currentWord.word.slice(0, this.currentWord.index).toUpperCase() +
                    this.currentWord.word.slice(this.currentWord.index)
                );
                if (this.currentWord.index >= this.currentWord.word.length) {
                    this.sound.play("kill", {volume: 0.4});
                    this.scoreState.score += CONST.SCORE_PER_LETTER * this.currentWord.word.length;
                    this.currentWord.text.destroy();
                    const tier = this.timeElapsed <20 ? "A" : this.timeElapsed < 40 ? "B" : "C";
                    const next = pick(tier as any, this.rng);
                    const txt2= this.add.bitmapText(480, 270, "bm", next, 36).setOrigin(0.5);
                    this.currentWord = { text: txt2, word: next, index: 0 };
                }
            } else {
                this.sound.play("type_bad", { volume: 0.4 });
                this.scoreState.errors++;
                this.scoreState.streak = Math.floor(this.scoreState.streak * 0.7);
                this.cameras.main.shake(50, 0.002);
            }

            const acc = updateAccuracy(this.scoreState);
            (this.children.getByName("score") as Phaser.GameObjects.BitmapText).setText(`Score: ${this.scoreState.score}`);
            (this.children.getByName("accuracy") as Phaser.GameObjects.BitmapText).setText("Accuracy: " + Math.round(acc*100) + "%");
        });
    }
    update(time: number, delta: number) {
        this.timeElapsed += delta / 1000;
    }
}