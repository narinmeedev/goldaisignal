const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
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
`;

fs.writeFileSync('scratch/inspect_modals.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/inspect_modals.js" as «class utf8»
tell application "Google Chrome"
    repeat with aWindow in every window
        repeat with aTab in every tab of aWindow
            if URL of aTab contains "sites.google.com/d/1jGLfpwGuv8dekzAvqfVKeQZ1hbES2lvA" then
                set res to (execute aTab javascript jsContent)
                return res
            end if
        end repeat
    end repeat
    return "Tab not found"
end tell
`;

fs.writeFileSync('scratch/inspect_modals.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/inspect_modals.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
