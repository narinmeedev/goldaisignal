
(() => {
    const viewPubSite = Array.from(document.querySelectorAll("[role='menuitem']")).find(m => 
        (m.innerText || "").toLowerCase().includes("view published site") || (m.innerText || "").includes("ดูไซต์ที่เผยแพร่")
    );

    if (viewPubSite) {
        viewPubSite.click();
        return "Clicked View published site";
    }
    return "Menu item not found";
})()
