
(() => {
    // Find Header title element
    const titleElements = Array.from(document.querySelectorAll("[contenteditable='true'], .public-DraftEditor-content, [role='textbox']")).map(el => ({
        tag: el.tagName,
        text: (el.innerText || "").trim(),
        ariaLabel: el.getAttribute("aria-label"),
        className: el.className
    }));

    // Find Publish button
    const publishBtn = Array.from(document.querySelectorAll("button, [role='button']")).find(b => 
        (b.innerText || "").trim() === "Publish" || (b.innerText || "").trim() === "เผยแพร่"
    );

    return JSON.stringify({
        titleElements: titleElements,
        hasPublishBtn: !!publishBtn,
        publishText: publishBtn ? publishBtn.innerText : null
    });
})()
