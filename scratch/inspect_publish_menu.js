
(() => {
    const menuItems = Array.from(document.querySelectorAll("[role='menuitem']")).map(m => ({
        text: (m.innerText || "").trim(),
        aria: m.getAttribute("aria-label")
    }));

    // If View published site is in menu, click it
    const viewPubSite = Array.from(document.querySelectorAll("[role='menuitem']")).find(m => 
        (m.innerText || "").toLowerCase().includes("view published site") || (m.innerText || "").includes("ดูไซต์ที่เผยแพร่")
    );

    // Or Publish settings
    const pubSettings = Array.from(document.querySelectorAll("[role='menuitem']")).find(m => 
        (m.innerText || "").toLowerCase().includes("publish settings") || (m.innerText || "").includes("การตั้งค่าการเผยแพร่")
    );

    return JSON.stringify({
        menuItems: menuItems,
        hasViewPubSite: !!viewPubSite,
        hasPubSettings: !!pubSettings
    });
})()
