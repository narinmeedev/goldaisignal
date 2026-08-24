
(() => {
    const dialog = document.querySelector("[role='dialog']");
    const openModals = Array.from(document.querySelectorAll("[role='dialog'], [role='menu'], [aria-modal='true']")).map(m => ({
        role: m.getAttribute("role"),
        aria: m.getAttribute("aria-label"),
        text: (m.innerText || "").slice(0, 100)
    }));

    return JSON.stringify({
        hasDialog: !!dialog,
        openModals: openModals
    });
})()
