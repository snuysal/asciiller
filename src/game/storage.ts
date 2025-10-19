export const storage = {
    getBestScore(): number { return Number(localStorage.getItem("st_bestScore") || 0); },
    setBestScore(n: number) { localStorage.setItem("st_bestScore", String(n)); },
    getBestStreak(): number { return Number(localStorage.getItem("st_bestStreak") || 0); },
    setBestStreak(n: number) { localStorage.setItem("st_bestStreak", String(n)); },
}
