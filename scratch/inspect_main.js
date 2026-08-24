
(() => {
    const main = document.querySelector("[role='main'], .zB4f2b");
    const iframes = Array.from(document.querySelectorAll("iframe")).map(f => ({
        src: f.src,
        rect: f.getBoundingClientRect()
    }));

    return JSON.stringify({
        hasMain: !!main,
        iframes: iframes
    });
})()
