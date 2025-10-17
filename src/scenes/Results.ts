import Phaser from 'phaser'

export default class Results extends Phaser.Scene {
    constructor() { super('Results') }
    create(data: { score: number }) {
        this.add.bitmapText(480, 220, 'bm', 'RESULTS', 48).setOrigin(0.5)
        this.add.bitmapText(480, 300, 'bm', `Score: ${data?.score ?? 0}`,
            32).setOrigin(0.5)
        this.add.bitmapText(480, 380, 'bm', 'Any key to retry',
            24).setOrigin(0.5)
        this.input.keyboard?.once('keydown', () => this.scene.start('Game'))
        this.input.once('pointerdown', () => this.scene.start('Game'))
    }
}
