
(() => {
    const dialog = document.querySelector("[role='dialog']");
    if (!dialog) return "No dialog";

    const publishBtn = Array.from(dialog.querySelectorAll("button, [role='button']")).find(b => 
        (b.innerText || "").trim().toLowerCase() === "publish" || (b.innerText || "").trim() === "เผยแพร่"
    );

    if (publishBtn) {
        publishBtn.click();
        return "Clicked Confirm Publish in dialog";
    }
    return "Publish button not found in dialog";
})()
