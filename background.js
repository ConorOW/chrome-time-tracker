let trackedSites = {};
let activeTabId = null;
let activeDomain = null;
let startTime = null;
const NOTIFY_INTERVAL = 900; // 15 minutes in seconds;

function checkForNewDay() {
    chrome.storage.sync.get(["trackedSites", "lastResetDate"], (data) => {
        let storedSites = data.trackedSites || {};
        let lastReset = data.lastResetDate;
        let today = new Date().toDateString();

        // ✅ If no reset date exists, set one
        if (!lastReset) {
            console.log("🆕 No reset date found, initializing...");
            chrome.storage.sync.set({ lastResetDate: today }, () => {
                console.log("✅ Initial lastResetDate set:", today);
            });
            return; // Exit to avoid double resetting
        }

        // ✅ If a new day has started, reset the timer
        if (lastReset !== today) {
            console.log("🌅 New day detected! Resetting time tracker...");

            for (let site in storedSites) {
                storedSites[site].timeSpentToday = 0;
            }

            chrome.storage.sync.set({
                trackedSites: storedSites,
                lastResetDate: today
            }, () => {
                console.log("✅ Time tracker reset for a new day:", today);
            });
        }
    });
}

// ✅ Run this check when the extension starts
checkForNewDay();

// ✅ Schedule periodic daily reset checks
chrome.alarms.create("dailyReset", { when: Date.now(), periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "dailyReset") {
        checkForNewDay();
    }
});

// ✅ 4️⃣ Keep the rest of your existing event listeners BELOW this
chrome.tabs.onActivated.addListener((activeInfo) => {
    console.log("🔄 Tab switched:", activeInfo);
    activeTabId = activeInfo.tabId;
    updateActiveDomain();
});

chrome.alarms.create("trackTime", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "trackTime") {
        trackTime();
    }
});

// Load tracked sites and reset daily time if necessary
chrome.storage.sync.get(["trackedSites", "lastResetDate"], (data) => {
    let lastReset = data.lastResetDate || new Date().toDateString();
    let today = new Date().toDateString();

    if (lastReset !== today) {
        for (let site in data.trackedSites) {
            data.trackedSites[site].timeSpentToday = 0;
        }
        chrome.storage.sync.set({ trackedSites: data.trackedSites, lastResetDate: today });
    }
    trackedSites = data.trackedSites || {};
    console.log("✅ Loaded tracked sites:", trackedSites);
});

// **Detect Active Tab on Startup**
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
        activeTabId = tabs[0].id;
        activeDomain = getRootDomain(tabs[0].url);
        startTime = Date.now();
        console.log("🔄 Startup detected active tab:", activeTabId, "Domain:", activeDomain);
    }
});

// **Detect Tab Switches**
chrome.tabs.onActivated.addListener((activeInfo) => {
    console.log("🔄 Tab switched:", activeInfo);
    activeTabId = activeInfo.tabId;
    updateActiveDomain();
});

// **Detect Navigation Updates**
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === activeTabId && changeInfo.url) {
        console.log("🔄 Navigated to new page:", changeInfo.url);
        updateActiveDomain();
    }
});

// **Ensure tracking runs every 10 seconds for debugging**
chrome.alarms.create("trackTime", { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "trackTime") trackTime();
});

// **Force Active Domain Detection**
function updateActiveDomain() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0 || !tabs[0].url) {
            console.log("🚨 No active tab detected.");
            return;
        }

        activeTabId = tabs[0].id;
        activeDomain = getRootDomain(tabs[0].url);
        startTime = Date.now(); // **Fix: Ensure startTime updates correctly**

        console.log("✅ Active domain updated to:", activeDomain);
    });
}

// **Updated: Track Time Correctly**
function trackTime() {
    if (!activeTabId || !startTime || !activeDomain) {
        console.log("🚨 Skipping tracking due to missing values:", { activeTabId, startTime, activeDomain });
        return;
    }

    chrome.storage.sync.get("trackedSites", (data) => {
        let storedSites = data.trackedSites || {};

        if (!storedSites[activeDomain]) {
            console.log(`🚫 Skipping tracking: ${activeDomain} is not in the tracked list.`);
            return;
        }

        // ✅ Calculate actual seconds spent
        const timeSpent = Math.floor((Date.now() - startTime) / 1000); // Convert ms to seconds
        const minutesSpent = Math.floor(timeSpent / 60); // Convert seconds to minutes

        if (minutesSpent > 0) {
            // ✅ Add time to stored data
            storedSites[activeDomain].timeSpentToday = (storedSites[activeDomain].timeSpentToday || 0) + minutesSpent;

            // ✅ Print time in hours if over 60 min, otherwise print minutes
            let totalTime = storedSites[activeDomain].timeSpentToday;
            let displayTime = totalTime >= 60 
                ? `${(totalTime / 60).toFixed(1)} hours`  // Convert minutes to hours with 1 decimal place
                : `${totalTime} minutes`;

            console.log(`✅ Tracking time for ${activeDomain}: ${displayTime}`);

            // ✅ Save updated time
            chrome.storage.sync.set({ trackedSites: storedSites });

            startTime = Date.now(); // Reset tracking cycle
        }
    });
}

// **Ensure Proper Domain Extraction**
function getRootDomain(url) {
    try {
        let hostname = new URL(url).hostname;
        let domainParts = hostname.split(".");
        if (domainParts.length > 2) {
            return domainParts.slice(-2).join("."); // Get main domain (e.g., "github.com")
        }
        return hostname;
    } catch (error) {
        console.error("🚨 Error extracting root domain:", error);
        return null;
    }
}

// **No Changes Here: Send Notifications**
function sendNotification(rootDomain, timeSpent) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icon.png",
        title: "Time Usage Alert ⏳",
        message: `You've spent ${Math.floor(timeSpent / 60)} minutes on ${rootDomain} today.`,
        priority: 2
    });
}
