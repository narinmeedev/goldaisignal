
(() => {
    const dialogs = Array.from(document.querySelectorAll("[role='dialog'], .freebirdMaterialEditorUiViewEditorDialog, .modal, div[tabindex='-1']")).map(d => ({
        tag: d.tagName,
        className: d.className,
        role: d.getAttribute("role")
    }));

    const textareas = Array.from(document.querySelectorAll("textarea, input")).map(t => ({
        tag: t.tagName,
        type: t.type,
        placeholder: t.placeholder,
        valLength: (t.value || "").length
    }));

    return JSON.stringify({
        dialogs: dialogs,
        textareas: textareas
    });
})()
