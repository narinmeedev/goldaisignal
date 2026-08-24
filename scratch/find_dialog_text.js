
(() => {
    const allMatching = Array.from(document.querySelectorAll("*")).filter(el => {
        const text = (el.innerText || "").trim();
        return text.includes("Embed code") || text.includes("By URL") || text.includes("ฝังโค้ด") || text.includes("ตาม URL");
    }).map(el => ({
        tag: el.tagName,
        className: el.className,
        role: el.getAttribute("role"),
        text: el.innerText.slice(0, 50)
    }));

    return JSON.stringify(allMatching);
})()
