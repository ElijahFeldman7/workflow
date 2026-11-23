import fs from "fs";
import path from "path";
import vm from "vm";

const extension = (file) => fs.readFileSync(path.join(__dirname, "../../studentvue-extension", file), "utf8");
const workflow = "https://workflow.sites.tjhsst.edu";

function loadWorker(tabs) {
  const addListener = jest.fn();
  const sendMessage = jest.fn().mockResolvedValue({ status: "ok" });
  const chrome = {
    runtime: { onMessageExternal: { addListener } },
    tabs: { query: jest.fn().mockResolvedValue(tabs), sendMessage },
  };
  vm.runInNewContext(extension("background.js"), { chrome, URL });
  const receive = addListener.mock.calls[0][0];
  return { receive, ...chrome.tabs };
}

test("only the top-level Workflow app can request a gradebook read", () => {
  const { receive, query } = loadWorker([]);
  const message = { type: "workflow:read-grades" };
  const respond = jest.fn();
  for (const sender of [
    { url: "https://other.example/app", origin: "https://other.example", frameId: 0 },
    { url: workflow + "/app", origin: workflow, frameId: 1 },
    { url: workflow + "/privacy", origin: workflow, frameId: 0 },
    { url: workflow + "/app", origin: "null", frameId: 0 },
  ]) {
    expect(receive(message, sender, respond)).toBeUndefined();
  }
  expect(query).not.toHaveBeenCalled();
  expect(respond).not.toHaveBeenCalled();
});

test("requires a single FCPS gradebook tab and messages its top frame", async () => {
  const gradebook = { id: 3, url: "https://sisstudent.fcps.edu/SVUE/PXP2_Gradebook.aspx?AGU=0", status: "complete" };
  const sender = { url: workflow + "/app", origin: workflow, frameId: 0 };
  const message = { type: "workflow:read-grades" };
  const single = loadWorker([gradebook, { url: "https://sisstudent.fcps.edu/SVUE/PXP2_Login.aspx" }]);
  const response = await new Promise((resolve) => expect(single.receive(message, sender, resolve)).toBe(true));
  expect(response.status).toBe("ok");
  expect(single.sendMessage).toHaveBeenCalledWith(3, { type: "read-gradebook" }, { frameId: 0 });
  const multiple = loadWorker([gradebook, { ...gradebook, id: 4 }]);
  const ambiguous = await new Promise((resolve) => multiple.receive(message, sender, resolve));
  expect(ambiguous.status).toBe("multiple-gradebooks");
  expect(multiple.sendMessage).not.toHaveBeenCalled();
});

test("the gradebook reader returns only visible course fields", () => {
  const gradebook = document.createElement("div");
  gradebook.innerHTML = `
    <div class="current breadcrumb-term">Q2</div>
    <div class="gb-class-row">
      <div class="period">1</div>
      <button class="course-title" data-focus="internal-student-id">Algebra 2</button>
      <div class="score">A- (92.5%)</div>
      <div class="teacher">Private teacher name</div>
    </div>
    <div class="gb-class-row"><button class="course-title">Biology</button><div class="score">N/A (0%)</div></div>
    <div class="gb-class-row"><button class="course-title" hidden>Hidden course</button><div class="score">93%</div></div>
    <input type="password" value="district-password">
  `;
  for (const element of gradebook.querySelectorAll("*")) {
    Object.defineProperty(element, "innerText", { value: element.textContent });
    element.getClientRects = () => element.hidden ? [] : [{}];
  }
  const addListener = jest.fn();
  const runtime = { id: "companion", onMessage: { addListener } };
  vm.runInNewContext(extension("gradebook.js"), {
    chrome: { runtime }, document: gradebook, location: { pathname: "/SVUE/PXP2_Gradebook.aspx" },
  });
  const respond = jest.fn();
  const receive = addListener.mock.calls[0][0];
  receive({ type: "read-gradebook" }, { id: "unknown" }, respond);
  expect(respond).not.toHaveBeenCalled();
  receive({ type: "read-gradebook" }, { id: "companion" }, respond);
  expect(respond).toHaveBeenCalledWith({
    status: "ok",
    term: "Q2",
    courses: [
      { name: "Algebra 2", period: "1", mark: "A-", percent: 92.5 },
      { name: "Biology", period: "", mark: "", percent: null },
    ],
  });
});
