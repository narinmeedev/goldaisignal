
(() => {
    // Check all menu items
    const menuItems = Array.from(document.querySelectorAll("[role='menuitem']")).map(m => ({
        text: (m.innerText || "").trim(),
        aria: m.getAttribute("aria-label")
    }));

    // Try finding embed in right sidebar
    const embedEl = Array.from(document.querySelectorAll("[role='menuitem']")).find(m => 
        (m.innerText || "").trim() === "Embed" || m.getAttribute("aria-label") === "Embed"
    );

    if (embedEl) {
        embedEl.click();
        return JSON.stringify({ clicked: true, menuItems: menuItems });
    }

    return JSON.stringify({ clicked: false, menuItems: menuItems });
})()
