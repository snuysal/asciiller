type Options = { mute: boolean; };

const KEY = "st_options";

function read(): Options {
    try {return {mute: JSON.parse(localStorage.getItem(KEY) || "{}").mute ?? false};}
    catch { return {mute: false};}
}

function write(opts: Options) {
    localStorage.setItem(KEY, JSON.stringify(opts));
}

export const options = {
    get mute() { return read().mute; },
    set mute(v: boolean) { write ({ ...read(), mute: v }); },
};