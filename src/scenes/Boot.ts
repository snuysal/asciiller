import Phaser from "phaser";

export default class Boot extends Phaser.Scene{
    constructor() { super("Boot") }
    preload() {
        this.load.image("arena", "/assets/bg/arena.png");
        this.load.bitmapFont( "bm", "/assets/font/bitmap.png", "/assets/font/bitmap.xml");
        this.load.audio("type_ok", "/assets/sfx/type_ok.wav");
        this.load.audio("type_bad", "/assets/sfx/type_bad.wav");
        this.load.audio("kill", "/assets/sfx/kill.mp3");
    }
    create() { this.scene.start("Title") }
}