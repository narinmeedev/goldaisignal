
(() => {
    const copyLinkBtn = document.querySelector("[aria-label*='Copy published site link'], [data-tooltip*='Copy published site link'], [aria-label*='คัดลอกลิงก์']");
    if (copyLinkBtn) {
        copyLinkBtn.click();
        setTimeout(() => {
            const linkInput = document.querySelector("[role='dialog'] input");
            if (linkInput) {
                console.log("Published Link:", linkInput.value);
            }
        }, 300);
        return "Clicked copy link button";
    }
    return "Copy link button not found";
})()
