(() => {
  if (!/^\/svue\/pxp2_gradebook\.aspx$/i.test(location.pathname)) return;

  const visible = (element) => Boolean(element?.getClientRects().length);
  const text = (element) => element?.innerText?.trim().replace(/\s+/g, " ") ?? "";
  const marks = "A-?|B[+-]?|C[+-]?|D[+-]?|F|P|PASS|NP|I|INC|W|WP|WF|NG";
  const scorePattern = new RegExp(
    String.raw`^(?:(${marks})\s*)?(?:\((\d+(?:\.\d+)?)\s*%\)|(\d+(?:\.\d+)?)\s*%)$`,
    "i"
  );
  const reversedScorePattern = new RegExp(String.raw`^(\d+(?:\.\d+)?)\s*%\s+(${marks})$`, "i");
  const markPattern = new RegExp(`^(?:${marks})$`, "i");

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || sender.tab || message?.type !== "read-gradebook") {
      return;
    }
    const courses = [];
    for (const row of document.querySelectorAll(".gb-class-row")) {
      const title = row.querySelector(".course-title");
      if (!visible(title)) continue;
      const name = text(title);
      if (!name || name.length > 180) continue;

      const score = text(row.querySelector(".score")).replace(/\u2212/g, "-");
      // A plain percentage is also used on some views. Keep a reported
      // letter even when the course has no numeric percentage.
      const match = score.match(scorePattern);
      const reversed = score.match(reversedScorePattern);
      const numeric = match?.[2] ?? match?.[3] ?? reversed?.[1];
      const percent = numeric === undefined ? null : Number(numeric);
      const mark = (match?.[1] || reversed?.[2] || (markPattern.test(score) ? score : "")).toUpperCase();
      courses.push({
        name,
        period: text(row.querySelector(".period")).slice(0, 16),
        percent: Number.isFinite(percent) ? percent : null,
        mark,
      });
    }

    if (courses.length === 0 || courses.length > 50) {
      respond({ status: "no-courses" });
      return;
    }
    const term = [...document.querySelectorAll(".current.breadcrumb-term")].find(visible);
    respond({ status: "ok", courses, term: text(term).slice(0, 48) });
  });
})();
