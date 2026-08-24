
(() => {
    // Find the atari embed iframe
    const embedIframe = Array.from(document.querySelectorAll("iframe")).find(f => f.src && f.src.includes("gstatic.com/atari/embeds"));
    if (!embedIframe) return JSON.stringify({ found: false });

    // Look at its parent elements
    let parent = embedIframe.parentElement;
    const parentChain = [];
    while (parent && parentChain.length < 10) {
        parentChain.push({
            tag: parent.tagName,
            className: parent.className,
            styleWidth: parent.style.width,
            styleHeight: parent.style.height
        });
        parent = parent.parentElement;
    }

    return JSON.stringify({
        found: true,
        parentChain: parentChain
    });
})()
