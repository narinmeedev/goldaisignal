
(() => {
    // Click view in snackbar
    const viewBtn = Array.from(document.querySelectorAll("a, button, [role='button']")).find(el => (el.innerText || "").trim().toLowerCase() === "view" || (el.innerText || "").trim() === "ดู");
    if (viewBtn) {
        viewBtn.click();
        return "Clicked view button";
    }

    const copyBtn = document.querySelector("[data-tooltip='Copy published site link'], [aria-label*='Copy published site link'], [aria-label*='คัดลอกลิงก์']");
    if (copyBtn) {
        copyBtn.click();
        return "Clicked copy link button";
    }

    return "Button not found";
})()
