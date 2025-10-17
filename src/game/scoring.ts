export type ScoreState = { score: number; correct: number; errors: number; streak: number };

export function updateAccuracy(scoreState: ScoreState) : number {
    const total = scoreState.correct + scoreState.errors;
    return total === 0 ? 1 : scoreState.correct / total;
}