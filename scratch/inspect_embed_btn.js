
(() => {
    // In Google Sites sidebar, let's find the Insert tab and its items
    const insertTab = Array.from(document.querySelectorAll("[role='tab']")).find(t => (t.innerText || "").includes("Insert") || (t.innerText || "").includes("แทรก"));
    if (insertTab) insertTab.click();

    // Now find the Embed button in the Insert panel
    const allButtons = Array.from(document.querySelectorAll("*")).filter(el => {
        const text = (el.innerText || "").trim();
        const aria = el.getAttribute("aria-label") || "";
        return (text === "Embed" || aria === "Embed" || text === "ฝัง" || aria === "ฝัง") &&
               (el.tagName === "DIV" || el.tagName === "BUTTON") &&
               el.offsetParent !== null;
    }).map(el => ({
        tag: el.tagName,
        className: el.className,
        role: el.getAttribute("role"),
        aria: el.getAttribute("aria-label"),
        text: el.innerText
    }));

    return JSON.stringify(allButtons);
})()
