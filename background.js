let trackedSites = {};
let activeTabId = null;
let activeDomain = null;
let startTime = null;
const NOTIFY_INTERVAL = 900; // 15 minutes in seconds;

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
chrome.alarms.create("trackTime", { periodInMinutes: 0.1667 });

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

        console.log(`⏳ Time Spent on ${activeDomain}: ${timeSpent} sec`);

        // ✅ Convert to minutes only when 60 full seconds have passed
        const minutesSpent = Math.floor(timeSpent / 60); // Remove `Math.max(1, ...)`

        if (minutesSpent > 0) { // Only update if at least 1 full minute has passed
            storedSites[activeDomain].timeSpentToday = (storedSites[activeDomain].timeSpentToday || 0) + minutesSpent;

            console.log(`✅ Tracking time for ${activeDomain}: ${storedSites[activeDomain].timeSpentToday} min`);

            chrome.storage.sync.set({ trackedSites: storedSites }, () => {
                chrome.storage.sync.get("trackedSites", (newData) => {
                    console.log("✅ After Saving:", JSON.stringify(newData.trackedSites, null, 2));
                });
            });

            startTime = Date.now(); // ✅ Reset startTime only when a minute is logged
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
