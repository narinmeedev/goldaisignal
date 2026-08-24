
(() => {
    const dialog = document.querySelector("[role='dialog']");
    if (!dialog) return JSON.stringify({ error: "No dialog" });

    const insertBtn = Array.from(dialog.querySelectorAll("button, [role='button']")).find(b => 
        (b.innerText || "").trim().toLowerCase() === "insert" || (b.innerText || "").trim() === "แทรก"
    );

    let clicked = false;
    if (insertBtn) {
        insertBtn.click();
        clicked = true;
    }

    return JSON.stringify({
        hasInsertBtn: !!insertBtn,
        insertBtnDisabled: insertBtn ? insertBtn.disabled || insertBtn.getAttribute("aria-disabled") : null,
        clicked: clicked,
        allButtons: Array.from(dialog.querySelectorAll("button, [role='button']")).map(b => (b.innerText || "").trim())
    });
})()
