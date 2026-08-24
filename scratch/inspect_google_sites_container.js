const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    // Find the atari embed iframe
    const embedIframe = Array.from(document.querySelectorAll("iframe")).find(f => f.src && f.src.includes("gstatic.com/atari/embeds"));
    if (!embedIframe) return JSON.stringify({ found: false });

    // Look at its parent elements
    let parent = embedIframe.parentElement;
    const parentChain = [];
    while (parent && parentChain.length < 10) {
        parentChain.push({
            tag: parent.tagName,
            className: parent.className,
            styleWidth: parent.style.width,
            styleHeight: parent.style.height
        });
        parent = parent.parentElement;
    }

    return JSON.stringify({
        found: true,
        parentChain: parentChain
    });
})()
`;

fs.writeFileSync('scratch/inspect_embed_container.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/inspect_embed_container.js" as «class utf8»
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

fs.writeFileSync('scratch/inspect_embed_container.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/inspect_embed_container.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
