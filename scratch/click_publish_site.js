
(() => {
    const publishBtn = Array.from(document.querySelectorAll("button, [role='button']")).find(b => 
        (b.innerText || "").trim() === "Publish" || (b.innerText || "").trim() === "เผยแพร่"
    );

    if (publishBtn) {
        publishBtn.click();
        return "Clicked Publish button";
    }
    return "Publish button not found";
})()
