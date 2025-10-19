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

        if (score > storage.getBestScore()) storage.setBestScore(score);
        if (streak > storage.getBestStreak()) storage.setBestStreak(streak);

        const bestScore = storage.getBestScore();
        const bestStreak = storage.getBestStreak();

        this.add.bitmapText(480, 180, "bm", "RESULTS", 48).setOrigin(0.5);
        this.add.bitmapText(480, 250, "bm", `Score: ${score}`, 32).setOrigin(0.5);
        this.add.bitmapText(480, 290, "bm", `Accuracy: ${accuracyPct}%`, 24).setOrigin(0.5);
        this.add.bitmapText(480, 320, "bm", `Longest Streak: ${streak}`, 24).setOrigin(0.5);

        this.add.bitmapText(480, 370, "bm", `Best Score: ${bestScore}`, 24).setOrigin(0.5);
        this.add.bitmapText(480, 400, "bm", `Best Streak: ${bestStreak}`, 24).setOrigin(0.5);

        this.add.bitmapText(480, 460, "bm", "Any key / click to retry", 20).setOrigin(0.5);

        this.input.keyboard?.once("keydown", () => this.scene.start("Game"));
        this.input.once("pointerdown", () => this.scene.start("Game"));
    }
}
