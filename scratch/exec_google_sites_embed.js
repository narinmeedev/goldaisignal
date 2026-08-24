const fs = require('fs');
const { execSync } = require('child_process');

const htmlContent = fs.readFileSync('scratch/google_site_10_games.html', 'utf8');

// Embed function that executes directly in page context with async/await
const jsCode = `
(async () => {
    // 1. Find and click Embed
    const allMenuItems = Array.from(document.querySelectorAll("[role='menuitem'], [role='button'], div"));
    const embedBtn = allMenuItems.find(el => (el.innerText || "").trim() === "Embed" && (el.getAttribute("role") === "menuitem" || el.getAttribute("aria-label") === "Embed"));
    
    if (!embedBtn) return "Error: Embed menuitem not found";
    embedBtn.click();

    // 2. Wait for dialog
    let dialog = null;
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 100));
        dialog = document.querySelector("[role='dialog']");
        if (dialog) break;
    }
    if (!dialog) return "Error: Dialog not opened";

    // 3. Click Embed code tab
    const tabs = Array.from(dialog.querySelectorAll("[role='tab']"));
    const codeTab = tabs.find(t => (t.innerText || "").toLowerCase().includes("embed code") || (t.innerText || "").includes("ฝังโค้ด"));
    if (codeTab) codeTab.click();
    await new Promise(r => setTimeout(r, 200));

    // 4. Fill textarea
    const textarea = dialog.querySelector("textarea");
    if (!textarea) return "Error: Textarea not found";

    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeSetter.call(textarea, ${JSON.stringify(htmlContent)});
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));

    // 5. Click Next
    const nextBtn = Array.from(dialog.querySelectorAll("button, [role='button']")).find(b => 
        (b.innerText || "").trim().toLowerCase() === "next" || (b.innerText || "").trim() === "ถัดไป"
    );
    if (!nextBtn) return "Error: Next button not found";
    nextBtn.removeAttribute("disabled");
    nextBtn.removeAttribute("aria-disabled");
    nextBtn.click();

    // 6. Wait for Insert button
    let insertBtn = null;
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 100));
        insertBtn = Array.from(dialog.querySelectorAll("button, [role='button']")).find(b => 
            (b.innerText || "").trim().toLowerCase() === "insert" || (b.innerText || "").trim() === "แทรก"
        );
        if (insertBtn && !insertBtn.disabled && !insertBtn.getAttribute("aria-disabled")) break;
    }
    if (!insertBtn) return "Error: Insert button not found";
    insertBtn.click();

    return "Success: 10 Games Review Embedded!";
})().then(res => {
    window.__embedResult = res;
});
"Started automation";
`;

fs.writeFileSync('scratch/do_embed.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/do_embed.js" as «class utf8»
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

fs.writeFileSync('scratch/do_embed.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/do_embed.scpt', { encoding: 'utf8' });
    console.log('Launch:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
