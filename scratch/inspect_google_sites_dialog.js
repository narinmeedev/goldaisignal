const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
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
`;

fs.writeFileSync('scratch/inspect_dialog.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/inspect_dialog.js" as «class utf8»
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

fs.writeFileSync('scratch/inspect_dialog.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/inspect_dialog.scpt', { encoding: 'utf8' });
    console.log('Dialog:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
