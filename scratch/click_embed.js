
(() => {
    // Find embed button
    const embedEl = Array.from(document.querySelectorAll("[aria-label='Embed'], [role='menuitem']")).find(el => 
        (el.innerText || "").trim() === "Embed" || el.getAttribute("aria-label") === "Embed"
    );

    if (embedEl) {
        embedEl.click();
        return "Clicked embed item";
    }
    return "Embed item not found";
})()
