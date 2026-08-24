const fs = require('fs');
const { execSync } = require('child_process');

const payload = JSON.parse(fs.readFileSync('scratch/wordpress_post_payload.json', 'utf8'));

const jsCode = `
(() => {
    const titleArea = document.querySelector("#inspector-textarea-control-0");
    const contentArea = document.querySelector("#post-content-0");
    const cmContent = document.querySelector(".cm-content");

    if (titleArea) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        nativeSetter.call(titleArea, ${JSON.stringify(payload.title)});
        titleArea.dispatchEvent(new Event('input', { bubbles: true }));
        titleArea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (contentArea) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        nativeSetter.call(contentArea, ${JSON.stringify(payload.content)});
        contentArea.dispatchEvent(new Event('input', { bubbles: true }));
        contentArea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (cmContent) {
        cmContent.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, ${JSON.stringify(payload.content)});
    }

    return JSON.stringify({
        titleSet: titleArea ? titleArea.value : null,
        contentLength: contentArea ? contentArea.value.length : 0,
        cmLength: cmContent ? cmContent.innerText.length : 0
    });
})()
`;

fs.writeFileSync('scratch/inject.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/inject.js" as «class utf8»
tell application "Google Chrome"
    repeat with aWindow in every window
        repeat with aTab in every tab of aWindow
            if URL of aTab contains "gameversereviews.wordpress.com/wp-admin" then
                set res to (execute aTab javascript jsContent)
                return res
            end if
        end repeat
    end repeat
    return "Tab not found"
end tell
`;

fs.writeFileSync('scratch/inject.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/inject.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
