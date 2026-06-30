// input.js - Gestión del teclado

export const keys = { w: false, s: false, a: false, d: false, space: false };

export function initInput() {
    window.addEventListener('keydown', (e) => updateKey(e.key, true));
    window.addEventListener('keyup', (e) => updateKey(e.key, false));
}

function updateKey(key, isPressed) {
    const k = key.toLowerCase();
    if (k === 'w' || key === 'arrowup') keys.w = isPressed;
    if (k === 's' || key === 'arrowdown') keys.s = isPressed;
    if (k === 'a' || key === 'arrowleft') keys.a = isPressed;
    if (k === 'd' || key === 'arrowright') keys.d = isPressed;
    if (k === ' ' || key === 'spacebar') keys.space = isPressed;
}
