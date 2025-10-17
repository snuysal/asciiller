export const storage = {
    getBest(): number { return Number(localStorage.getItem("st_bestScore") || 0); },
    setBest(n: number) { localStorage.setItem("st_bestScore", String(n)); }
}