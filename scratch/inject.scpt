
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
