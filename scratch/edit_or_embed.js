
(() => {
    // Check if there is an existing embed tile to edit
    const embedTile = document.querySelector("tile[aria-label*='Embed'], tile[aria-label*='Custom Embed'], .atari-embed-container, iframe[src*='atari/embeds']");
    
    // If we click embedTile or select it
    if (embedTile) {
        embedTile.click();
    }

    // Check for edit button (pencil) or click Embed again
    const editBtn = document.querySelector("[aria-label='Edit code'], [data-tooltip='Edit code'], [aria-label*='Edit']");
    if (editBtn) {
        editBtn.click();
        return "Clicked edit code button";
    }

    // Otherwise click Embed menu
    const embedEl = Array.from(document.querySelectorAll("[aria-label='Embed'], [role='menuitem']")).find(el => 
        (el.innerText || "").trim() === "Embed" || el.getAttribute("aria-label") === "Embed"
    );
    if (embedEl) {
        embedEl.click();
        return "Clicked Embed button";
    }

    return "Embed button not found";
})()
