
(() => {
    // Check iframes
    const iframes = Array.from(document.querySelectorAll("iframe")).map(f => ({
        src: f.src ? f.src.slice(0, 50) : null,
        width: f.width || f.style.width,
        height: f.height || f.style.height
    }));

    // Check Site Document Title input
    const docTitleInput = document.querySelector("[aria-label='Document title'], .drive-header-title-input, input[aria-label='Enter site name']");

    // Check Page title in header
    const pageHeaderTitle = document.querySelector("[data-text='Your page title'], [aria-label='Page title'], .public-DraftEditor-content");

    return JSON.stringify({
        iframeCount: iframes.length,
        iframes: iframes,
        docTitleFound: !!docTitleInput,
        docTitleVal: docTitleInput ? docTitleInput.value : null
    });
})()
