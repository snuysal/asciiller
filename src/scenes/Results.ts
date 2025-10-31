import Phaser from 'phaser';
import { storage } from '../game/storage';

type ResultsData = {
    score: number;
    accuracy?: number;
    longestStreak?: number;
}

export default class Results extends Phaser.Scene {
    constructor() { super('Results') }

    create(data: ResultsData) {
        const score = data?.score ?? 0;
        const accuracyPct = Math.round((data?.accuracy ?? 0) * 100);
        const streak = data?.longestStreak ?? 0;

        const prevBestScore = storage.getBestScore();
        const prevBestStreak = storage.getBestStreak();

        const isNewBestScore = score > prevBestScore;
        const isNewBestStreak = score > prevBestStreak;

        if (isNewBestScore) storage.setBestScore(score);
        if (isNewBestStreak) storage.setBestStreak(streak);

        const bestScore = storage.getBestScore();
        const bestStreak = storage.getBestStreak();

        this.add.bitmapText(480, 180, "bm", "RESULTS", 48).setOrigin(0.5);

        const scoreText = this.add.bitmapText(480, 250, "bm", `Score: ${score.toLocaleString()}`, 32).setOrigin(0.5);
        if (isNewBestScore) {
            const badge = this.add.bitmapText(scoreText.x + scoreText.width / 2 + 12, 250, "bm", "NEW BEST!", 20)
                .setOrigin(0, 0.5)
                .setTint(0xffea00);
            this.tweens.add({
                targets: badge,
                scale: 1.15,
                yoyo: true,
                repeat: -1,
                duration: 450,
            });
        }
        this.add.bitmapText(480, 290, "bm", `Accuracy: ${accuracyPct}%`, 24).setOrigin(0.5);
        this.add.bitmapText(480, 320, "bm", `Longest Streak: ${streak}`, 24).setOrigin(0.5);

        this.add.bitmapText(480, 370, "bm", `Best Score: ${bestScore.toLocaleString()}`, 24).setOrigin(0.5);
        this.add.bitmapText(480, 400, "bm", `Best Streak: ${bestStreak}`, 24).setOrigin(0.5);

        this.add.bitmapText(480, 460, "bm", "Any key / click to retry", 20).setOrigin(0.5);

        this.input.keyboard?.once("keydown", () => this.scene.start("Game"));
        this.input.once("pointerdown", () => this.scene.start("Game"));
    }
}
