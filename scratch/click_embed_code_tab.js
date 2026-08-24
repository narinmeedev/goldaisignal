
(() => {
    const dialog = document.querySelector("[role='dialog']");
    if (!dialog) return "No dialog";

    const embedCodeTab = Array.from(dialog.querySelectorAll("[role='tab']")).find(t => 
        (t.innerText || "").trim().toLowerCase().includes("embed code") || (t.innerText || "").trim().includes("ฝังโค้ด")
    );

    if (embedCodeTab) {
        embedCodeTab.click();
        return "Clicked Embed code tab";
    }
    return "Embed code tab not found";
})()
