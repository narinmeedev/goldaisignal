const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    const allEls = Array.from(document.querySelectorAll("*")).map(el => {
        const text = (el.innerText || "").trim();
        const aria = el.getAttribute("aria-label") || "";
        const role = el.getAttribute("role") || "";
        return { el, text, aria, role, tag: el.tagName };
    });

    const embedMatches = allEls.filter(item => 
        (item.text === "Embed" || item.text === "ฝัง" || item.aria.includes("Embed") || item.aria.includes("ฝัง")) &&
        (item.tag === "BUTTON" || item.role === "button" || item.role === "tab" || item.tag === "DIV")
    );

    const siteTitleEl = document.querySelector("[aria-label='Enter site name'], [aria-label='Site name'], .drive-header-title-input, .jss1");

    return JSON.stringify({
        embedMatches: embedMatches.map(m => ({ text: m.text, aria: m.aria, role: m.role, tag: m.tag })),
        pageTitleText: document.title
    });
})()
`;

fs.writeFileSync('scratch/inspect_sites.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/inspect_sites.js" as «class utf8»
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

fs.writeFileSync('scratch/inspect_sites.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/inspect_sites.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
