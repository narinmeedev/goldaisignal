
(() => {
    // Look for snackbar notification / view link
    const viewLinks = Array.from(document.querySelectorAll("a, button, [role='button']")).filter(el => {
        const text = (el.innerText || "").trim().toLowerCase();
        return text.includes("view") || text.includes("ดู") || text.includes("copy") || (el.href && el.href.includes("sites.google.com/view/"));
    }).map(el => ({ text: el.innerText, href: el.href }));

    // Also look at publish options menu
    const copyLinkBtn = document.querySelector("[aria-label='Copy published site link']");

    return JSON.stringify({
        viewLinks: viewLinks,
        hasCopyLinkBtn: !!copyLinkBtn,
        copyLinkAria: copyLinkBtn ? copyLinkBtn.getAttribute("aria-label") : null,
        title: document.title
    });
})()
