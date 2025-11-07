import Phaser from "phaser";
import { options } from "../game/options";
import * as CONST from "../game/const";
import Game from "./Game";

export default class Pause extends Phaser.Scene {
    constructor() { super("Pause"); }

    create() {
        this.add.rectangle(480, 270, 960, 570, 0x000000, 0.6);
        this.makeHUD();

        const resume = () => { this.scene.stop(); this.scene.resume("Game"); };

        this.input.keyboard?.once("keydown-ESC", resume);
        this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === "m") return; // ignore M
            resume();
        }, this);
        this.input.once("pointerdown", resume);

        this.input.keyboard?.on("keydown-M", () => {
            const next = !this.sound.mute;
            this.sound.mute = next;
            options.mute = next;

            const gameScene = this.scene.get("Game") as Game;
            gameScene.updateMuteIcon();
        });
    }

    private makeHUD() {
        const fontKey = CONST.HUD.FONT_KEY;
        this.add.bitmapText(480, 220, fontKey, "PAUSED", 48).setOrigin(0.5);
        this.add.bitmapText(480, 300, fontKey, "[ESC] Resume   [M] Mute/Unmute", 24).setOrigin(0.5);
        this.add.bitmapText(480, 340, fontKey, "Click / any key to resume", 20).setOrigin(0.5);
    }
}