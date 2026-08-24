
(() => {
    const dialog = document.querySelector("[role='dialog']");
    if (!dialog) return JSON.stringify({ hasDialog: false });

    const tabs = Array.from(dialog.querySelectorAll("[role='tab']")).map(t => ({
        text: (t.innerText || "").trim(),
        selected: t.getAttribute("aria-selected")
    }));

    const textareas = Array.from(dialog.querySelectorAll("textarea, input")).map(i => ({
        tag: i.tagName,
        type: i.type,
        placeholder: i.placeholder,
        ariaLabel: i.getAttribute("aria-label"),
        className: i.className
    }));

    const buttons = Array.from(dialog.querySelectorAll("button, [role='button']")).map(b => ({
        text: (b.innerText || "").trim(),
        disabled: b.disabled || b.getAttribute("aria-disabled")
    }));

    return JSON.stringify({
        hasDialog: true,
        tabs: tabs,
        inputs: textareas,
        buttons: buttons
    });
})()
