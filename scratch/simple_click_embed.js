
(() => {
    // 1. Click embed item
    const embedEl = Array.from(document.querySelectorAll("[role='menuitem']")).find(el => 
        (el.innerText || "").trim() === "Embed" || el.getAttribute("aria-label") === "Embed"
    );
    if (!embedEl) return "No embed item";
    embedEl.click();

    return "Clicked embed item";
})()
