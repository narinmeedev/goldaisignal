
(() => {
    const el = document.querySelector(".LhYFUe[aria-label='Embed'], [role='menuitem'][aria-label='Embed']");
    if (!el) return "Embed element not found";

    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.click();

    return "Dispatched click events to Embed button";
})()
