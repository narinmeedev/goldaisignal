const fs = require('fs');
const { execSync } = require('child_process');

const htmlContent = fs.readFileSync('scratch/google_site_10_games.html', 'utf8');

const jsCode = `
(async () => {
    // 1. Click Embed in sidebar
    const embedEl = Array.from(document.querySelectorAll("[aria-label='Embed'], [role='menuitem']")).find(el => 
        (el.innerText || "").trim() === "Embed" || el.getAttribute("aria-label") === "Embed"
    );
    if (!embedEl) return JSON.stringify({ error: "Embed button not found" });
    embedEl.click();

    // Wait for dialog
    await new Promise(r => setTimeout(r, 400));
    const dialog = document.querySelector("[role='dialog']");
    if (!dialog) return JSON.stringify({ error: "Dialog did not open" });

    // 2. Click Embed code tab
    const embedCodeTab = Array.from(dialog.querySelectorAll("[role='tab']")).find(t => 
        (t.innerText || "").trim().toLowerCase().includes("embed code") || (t.innerText || "").trim().includes("ฝังโค้ด")
    );
    if (embedCodeTab) embedCodeTab.click();

    await new Promise(r => setTimeout(r, 300));

    // 3. Set HTML textarea value
    const textarea = dialog.querySelector("textarea");
    if (!textarea) return JSON.stringify({ error: "Textarea not found in dialog" });

    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeSetter.call(textarea, ${JSON.stringify(htmlContent)});
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

    await new Promise(r => setTimeout(r, 300));

    // 4. Click Next
    const nextBtn = Array.from(dialog.querySelectorAll("button, [role='button']")).find(b => 
        (b.innerText || "").trim().toLowerCase() === "next" || (b.innerText || "").trim() === "ถัดไป"
    );
    if (nextBtn) {
        nextBtn.removeAttribute("disabled");
        nextBtn.removeAttribute("aria-disabled");
        nextBtn.click();
    }

    await new Promise(r => setTimeout(r, 500));

    // 5. Click Insert
    const insertBtn = Array.from(dialog.querySelectorAll("button, [role='button']")).find(b => 
        (b.innerText || "").trim().toLowerCase() === "insert" || (b.innerText || "").trim() === "แทรก"
    );
    if (insertBtn) {
        insertBtn.click();
    }

    return JSON.stringify({
        success: true,
        htmlLength: ${htmlContent.length}
    });
})()
`;

fs.writeFileSync('scratch/deploy_10_games.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/deploy_10_games.js" as «class utf8»
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

fs.writeFileSync('scratch/deploy_10_games.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/deploy_10_games.scpt', { encoding: 'utf8' });
    console.log('Deploy Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
