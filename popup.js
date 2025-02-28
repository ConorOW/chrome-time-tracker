document.addEventListener("DOMContentLoaded", () => {
    const siteList = document.getElementById("site-list");
    const siteInput = document.getElementById("site-input");
    const addButton = document.getElementById("add-site");

    function updateUI() {
        chrome.storage.sync.get("trackedSites", (data) => {
            const sites = data.trackedSites || {};
            siteList.innerHTML = "";
            for (const site in sites) {
                const minutesToday = sites[site].timeSpentToday || 0;
                const li = document.createElement("li");
                li.textContent = `${site}: ${minutesToday} min today`;
                siteList.appendChild(li);
            }
        });
    }

    // Update the UI every second to show live data
    setInterval(updateUI, 1000);

    addButton.addEventListener("click", () => {
        let site = siteInput.value.trim();
        if (!site) {
            alert("Enter a valid site.");
            return;
        }

        site = getRootDomain(site);

        chrome.storage.sync.get("trackedSites", (data) => {
            const sites = data.trackedSites || {};
            if (!sites[site]) {
                sites[site] = { timeSpentToday: 0 };
                chrome.storage.sync.set({ trackedSites: sites }, updateUI);
            }
        });

        siteInput.value = "";
    });

    function getRootDomain(url) {
        try {
            let hostname = new URL(url).hostname;
            let domainParts = hostname.split(".");
            if (domainParts.length > 2) {
                return domainParts.slice(-2).join(".");
            }
            return hostname;
        } catch (error) {
            return url;
        }
    }

    updateUI();
});
