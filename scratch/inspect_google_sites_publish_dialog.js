const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
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
`;

fs.writeFileSync('scratch/inspect_publish_dialog.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/inspect_publish_dialog.js" as «class utf8»
tell application "Google Chrome"
    repeat with aWindow in every window
        repeat with aTab in every tab of aWindow
            if URL of aTab contains "sites.google.com" then
                set res to (execute aTab javascript jsContent)
                return res
            end if
        end repeat
    end repeat
    return "Tab not found"
end tell
`;

fs.writeFileSync('scratch/inspect_publish_dialog.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/inspect_publish_dialog.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
