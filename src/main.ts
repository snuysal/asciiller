import Phaser from "phaser";
import Boot from "./scenes/Boot";
import Title from "./scenes/Title";
import Game from "./scenes/Game";
import Pause from "./scenes/Pause";
import Results from "./scenes/Results";

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: "game",
    width: 800,
    height: 600,
    backgroundColor: "#0e0f13",
    pixelArt: true,
    physics: { default: "arcade", arcade: { debug: false } },
    scale: {mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH},
    scene: [Boot, Title, Game, Pause,Results],
}

new Phaser.Game(config)