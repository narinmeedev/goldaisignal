
(() => {
    const dialog = document.querySelector("[role='dialog']");
    const buttons = dialog ? Array.from(dialog.querySelectorAll("button, [role='button']")).map(b => ({
        text: (b.innerText || "").trim(),
        disabled: b.disabled || b.getAttribute("aria-disabled")
    })) : [];

    return JSON.stringify({
        hasDialog: !!dialog,
        buttons: buttons,
        embedResult: window.__embedResult || null
    });
})()
