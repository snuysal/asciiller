import Phaser from "phaser";

export default class Title extends Phaser.Scene {
  constructor() { super("Title"); }

  create() {
    // bg + title
    this.add.bitmapText(480, 220, "bm", "ASCIIller", 48).setOrigin(0.5);
    this.add.bitmapText(480, 320, "bm", "Press any key to start", 24).setOrigin(0.5);

    // start game on key or click/tap
    this.input.keyboard?.once("keydown", () => this.scene.start("Game"));
    this.input.once("pointerdown", () => this.scene.start("Game"));
  }
}
