
(() => {
    const headerButtons = Array.from(document.querySelectorAll("header button, .docs-material-button, [role='button']")).map(b => ({
        text: (b.innerText || "").trim().replace(/\n/g, ' '),
        aria: b.getAttribute("aria-label"),
        tooltip: b.getAttribute("data-tooltip"),
        disabled: b.disabled || b.getAttribute("aria-disabled")
    })).filter(b => b.text || b.aria || b.tooltip);

    return JSON.stringify(headerButtons.slice(0, 20));
})()
