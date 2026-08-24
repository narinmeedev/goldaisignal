
(() => {
    // Find copy link icon button next to preview/share
    const allButtons = Array.from(document.querySelectorAll("button, [role='button']")).map(b => ({
        aria: b.getAttribute("aria-label"),
        tooltip: b.getAttribute("data-tooltip"),
        text: (b.innerText || "").trim()
    }));

    // Find the dropdown next to Publish
    const publishOptionsBtn = document.querySelector("[aria-label='Publish options'], [data-tooltip='Publish options']");
    if (publishOptionsBtn) {
        publishOptionsBtn.click();
    }

    return JSON.stringify({
        buttons: allButtons.slice(0, 20),
        hasPublishOptions: !!publishOptionsBtn
    });
})()
