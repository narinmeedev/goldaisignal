
(() => {
    // Open publish options menu if not open
    const pubOptions = document.querySelector("[aria-label='Publish options']");
    if (pubOptions) pubOptions.click();

    setTimeout(() => {
        const pubSettings = Array.from(document.querySelectorAll("[role='menuitem']")).find(m => 
            (m.innerText || "").toLowerCase().includes("publish settings") || (m.innerText || "").includes("การตั้งค่าการเผยแพร่")
        );
        if (pubSettings) pubSettings.click();
    }, 200);

    return "Clicked publish settings";
})()
