import { validateGradebook } from "./grades";

const FCPS_LEGACY_ENDPOINT = "https://sisstudent.fcps.edu/SVUE/Service/PXPCommunication.asmx";
const service = "http://edupoint.com/webservices/";
const escapeXml = (text) => text.replace(/[&<>]/g, (character) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[character]
));

function requestBody(username, password) {
  return `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <ProcessWebServiceRequest xmlns="${service}">
        <userID>${escapeXml(username)}</userID>
        <password>${escapeXml(password)}</password>
        <skipLoginLog>0</skipLoginLog>
        <parent>0</parent>
        <webServiceHandleName>PXPWebServices</webServiceHandleName>
        <methodName>Gradebook</methodName>
        <paramStr>&lt;Params&gt;&lt;childIntId&gt;0&lt;/childIntId&gt;&lt;/Params&gt;</paramStr>
      </ProcessWebServiceRequest>
    </soap:Body>
  </soap:Envelope>`;
}

function parseXml(text) {
  if (/<!doctype/i.test(text)) return null;
  const document = new DOMParser().parseFromString(text, "application/xml");
  return document.querySelector("parsererror") ? null : document;
}

function child(element, name) {
  return element && Array.from(element.children).find((node) => node.localName === name);
}

const numberPattern = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

function number(text) {
  const value = text?.trim().replace(/%$/, "") || "";
  return numberPattern.test(value) && Number.isFinite(Number(value)) ? Number(value) : null;
}

function dateKey(value) {
  const text = value?.trim() || "";
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/);
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:$| )/);
  if (!iso && !us) return "";
  const [, year, month, day] = iso || [null, us[3], us[1], us[2]];
  const key = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(`${key}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().startsWith(key) ? key : "";
}

function parseAssignments(mark) {
  return Array.from(child(mark, "Assignments")?.children ?? []).flatMap((item, index) => {
    if (item.localName !== "Assignment") return [];
    const name = item.getAttribute("Measure")?.trim().slice(0, 300);
    if (!name) return [];
    const points = (item.getAttribute("Points") || "").split("/");
    const earned = points.length === 2 ? number(points[0]) : null;
    const possible = number(item.getAttribute("PointsPossible")) ?? number(item.getAttribute("PossiblePoints"))
      ?? number(points[points.length - 1]);
    return [{
      id: item.getAttribute("GradebookID") ? `assignment:${item.getAttribute("GradebookID")}` : `row:${name}-${index}`,
      name,
      category: item.getAttribute("Type")?.trim().slice(0, 120) || "",
      earned,
      possible,
      score: item.getAttribute("Score")?.trim().slice(0, 32) || "",
      comment: item.getAttribute("Notes")?.trim().slice(0, 1500)
        || item.getAttribute("Comment")?.trim().slice(0, 1500) || "",
      date: dateKey(item.getAttribute("DueDate")) || dateKey(item.getAttribute("Date")),
      gradedDate: dateKey(item.getAttribute("GradedDate")) || dateKey(item.getAttribute("DateGraded")),
      excluded: ["IsExcluded", "IsExcused", "IsDropped"].some((key) =>
        /^(?:true|yes|1)$/i.test(item.getAttribute(key) || "")
      ) || /^(?:ex|excused|exempt)$/i.test(item.getAttribute("Score")?.trim() || ""),
    }];
  });
}

function parseCategories(mark) {
  return Array.from(child(mark, "GradeCalculationSummary")?.children ?? []).flatMap((item) => {
    if (item.localName !== "AssignmentGradeCalc") return [];
    const name = item.getAttribute("Type")?.trim().slice(0, 120);
    const weight = number(item.getAttribute("Weight"));
    if (!name || /^total$/i.test(name) || weight === null) return [];
    const points = (item.getAttribute("Points") || "").split("/");
    return [{
      name,
      weight,
      earned: number(points[0]),
      possible: number(item.getAttribute("PointsPossible")) ?? number(points[1]),
    }];
  });
}

function parseGradebook(response) {
  const envelope = parseXml(response);
  const responseNode = envelope?.getElementsByTagNameNS(service, "ProcessWebServiceRequestResult")[0];
  const payload = responseNode && parseXml(responseNode.textContent.trim())?.documentElement;
  if (payload?.localName === "RT_ERROR") {
    const reason = payload.getAttribute("ERROR_MESSAGE") || "";
    if (/invalid (?:user|username|password|credentials)|incorrect password|account.*locked/i.test(reason)) {
      return { status: "legacy-sign-in-failed" };
    }
    if (/single sign.on|\bsso\b|legacy.*(?:disable|retir)|authentication.*disabled/i.test(reason)) {
      return { status: "legacy-retired" };
    }
    return { status: "legacy-unavailable" };
  }
  if (payload?.localName !== "Gradebook" || payload.getAttribute("ErrorMessage")) {
    return { status: "legacy-unavailable" };
  }

  const period = child(payload, "ReportingPeriod");
  const term = period?.getAttribute("GradePeriod") || "";
  const termStart = dateKey(period?.getAttribute("StartDate"));
  const courseElements = child(payload, "Courses")?.children ?? [];
  const imported = Array.from(courseElements).flatMap((course) => {
    if (course.localName !== "Course") return [];
    const name = course.getAttribute("Title")?.trim();
    if (!name || name.length > 180) return [];
    const marks = child(course, "Marks");
    const mark = Array.from(marks?.children ?? []).find((node) =>
      term && node.localName === "Mark" && node.getAttribute("MarkName") === term
    ) || child(marks, "Mark");
    const markText = mark?.getAttribute("CalculatedScoreString")?.trim().toUpperCase().replace(/\u2212/g, "-") || "";
    const percent = /^(?:N\/A|NA|--)$/i.test(markText) ? null : number(mark?.getAttribute("CalculatedScoreRaw"));
    return [{
      name,
      period: course.getAttribute("Period")?.trim().slice(0, 16) || "",
      percent,
      mark: markText,
      assignments: parseAssignments(mark),
      categories: parseCategories(mark),
    }];
  });
  if (!imported.length) return { status: "legacy-empty" };
  const result = validateGradebook({ status: "ok", term, courses: imported });
  if (result.status !== "ok") return result;
  return {
    ...result,
    ...(termStart ? { termStart } : {}),
    courses: result.courses.map((course, index) => ({
      ...course,
      assignments: imported[index].assignments,
      categories: imported[index].categories,
    })),
  };
}

export async function readLegacyGradebook({ username, password }, signal) {
  const response = await fetch(FCPS_LEGACY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body: requestBody(username, password),
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    signal,
  });
  if (response.status === 401 || response.status === 403) return { status: "legacy-sign-in-failed" };
  if (response.status === 404 || response.status === 410) return { status: "legacy-retired" };
  if (!response.ok) return { status: "legacy-unavailable" };
  return parseGradebook(await response.text());
}
