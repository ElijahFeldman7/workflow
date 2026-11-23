const portal = "https://sisstudent.fcps.edu";
const workflowOrigins = new Set(["https://workflow.sites.tjhsst.edu", "http://localhost:3000"]);

async function readOpenGradebook() {
  const tabs = await chrome.tabs.query({ url: portal + "/*" });
  const gradebookTabs = tabs.filter(
    (tab) => tab.url &&
      /^\/svue\/pxp2_gradebook\.aspx$/i.test(new URL(tab.url).pathname)
  );

  if (gradebookTabs.length === 0) return { status: "open-gradebook" };
  if (gradebookTabs.length > 1) return { status: "multiple-gradebooks" };
  const [tab] = gradebookTabs;
  if (tab.status !== "complete" || tab.pendingUrl) return { status: "waiting" };

  try {
    return await chrome.tabs.sendMessage(tab.id, { type: "read-gradebook" }, { frameId: 0 });
  } catch {
    return { status: "reload-gradebook" };
  }
}

chrome.runtime.onMessageExternal.addListener((message, sender, respond) => {
  if (!sender.url || sender.frameId !== 0) return;
  const { origin, pathname } = new URL(sender.url);
  if (!workflowOrigins.has(origin) || sender.origin !== origin || pathname !== "/app") return;
  if (message?.type !== "workflow:read-grades") return;

  readOpenGradebook().then(respond, () => respond({ status: "unavailable" }));
  return true;
});
