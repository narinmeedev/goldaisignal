const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    // Look for snackbar notification / view link
    const viewLinks = Array.from(document.querySelectorAll("a, button, [role='button']")).filter(el => {
        const text = (el.innerText || "").trim().toLowerCase();
        return text.includes("view") || text.includes("ดู") || text.includes("copy") || (el.href && el.href.includes("sites.google.com/view/"));
    }).map(el => ({ text: el.innerText, href: el.href }));

    // Also look at publish options menu
    const copyLinkBtn = document.querySelector("[aria-label='Copy published site link']");

    return JSON.stringify({
        viewLinks: viewLinks,
        hasCopyLinkBtn: !!copyLinkBtn,
        copyLinkAria: copyLinkBtn ? copyLinkBtn.getAttribute("aria-label") : null,
        title: document.title
    });
})()
`;

fs.writeFileSync('scratch/inspect_published_sites_link.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/inspect_published_sites_link.js" as «class utf8»
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

fs.writeFileSync('scratch/inspect_published_sites_link.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/inspect_published_sites_link.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
