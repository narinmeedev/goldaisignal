
(() => {
    const dialog = document.querySelector("[role='dialog']");
    if (!dialog) return JSON.stringify({ hasDialog: false });

    const inputs = Array.from(dialog.querySelectorAll("input")).map(i => ({
        value: i.value,
        placeholder: i.placeholder,
        ariaLabel: i.getAttribute("aria-label")
    }));

    const buttons = Array.from(dialog.querySelectorAll("button, [role='button']")).map(b => ({
        text: (b.innerText || "").trim(),
        disabled: b.disabled || b.getAttribute("aria-disabled")
    }));

    return JSON.stringify({
        hasDialog: true,
        dialogTitle: dialog.getAttribute("aria-label") || (dialog.querySelector("h2, .freebirdMaterialEditorDialogTitle") ? dialog.querySelector("h2, .freebirdMaterialEditorDialogTitle").innerText : null),
        inputs: inputs,
        buttons: buttons
    });
})()
