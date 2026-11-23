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

function parseGradebook(response) {
  const envelope = parseXml(response);
  const result = envelope?.getElementsByTagNameNS(service, "ProcessWebServiceRequestResult")[0];
  const payload = result && parseXml(result.textContent.trim())?.documentElement;
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

  const term = child(payload, "ReportingPeriod")?.getAttribute("GradePeriod") || "";
  const courseElements = child(payload, "Courses")?.children ?? [];
  const courses = Array.from(courseElements).flatMap((course) => {
    if (course.localName !== "Course") return [];
    const name = course.getAttribute("Title")?.trim();
    if (!name || name.length > 180) return [];
    const marks = child(course, "Marks");
    const mark = Array.from(marks?.children ?? []).find((node) =>
      term && node.localName === "Mark" && node.getAttribute("MarkName") === term
    ) || child(marks, "Mark");
    const markText = mark?.getAttribute("CalculatedScoreString")?.trim().toUpperCase().replace(/\u2212/g, "-") || "";
    const raw = mark?.getAttribute("CalculatedScoreRaw")?.trim().replace(/%$/, "") || "";
    const percent = /^(?:N\/A|NA|--)$/i.test(markText) || !/^\d+(?:\.\d+)?$/.test(raw)
      ? null : Number(raw);
    return [{
      name,
      period: course.getAttribute("Period")?.trim().slice(0, 16) || "",
      percent,
      mark: markText,
    }];
  });
  return courses.length ? validateGradebook({ status: "ok", term, courses }) : { status: "legacy-empty" };
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
