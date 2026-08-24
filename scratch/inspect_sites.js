
(() => {
    const allEls = Array.from(document.querySelectorAll("*")).map(el => {
        const text = (el.innerText || "").trim();
        const aria = el.getAttribute("aria-label") || "";
        const role = el.getAttribute("role") || "";
        return { el, text, aria, role, tag: el.tagName };
    });

    const embedMatches = allEls.filter(item => 
        (item.text === "Embed" || item.text === "ฝัง" || item.aria.includes("Embed") || item.aria.includes("ฝัง")) &&
        (item.tag === "BUTTON" || item.role === "button" || item.role === "tab" || item.tag === "DIV")
    );

    const siteTitleEl = document.querySelector("[aria-label='Enter site name'], [aria-label='Site name'], .drive-header-title-input, .jss1");

    return JSON.stringify({
        embedMatches: embedMatches.map(m => ({ text: m.text, aria: m.aria, role: m.role, tag: m.tag })),
        pageTitleText: document.title
    });
})()
