import { readLegacyGradebook } from "./studentvueLegacy";

const wrap = (payload) => `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body><ProcessWebServiceRequestResponse xmlns="http://edupoint.com/webservices/">
    <ProcessWebServiceRequestResult><![CDATA[${payload}]]></ProcessWebServiceRequestResult>
  </ProcessWebServiceRequestResponse></soap:Body>
</soap:Envelope>`;

const credentials = { username: "student&1", password: "synthetic<password>&" };
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test("posts directly to FCPS and returns only the active term and course grades", async () => {
  const text = wrap(`<Gradebook ErrorMessage="">
    <ReportingPeriod GradePeriod="Q2"/>
    <Courses>
      <Course Title="Algebra 2" Period="1" StaffEMail="private@example.com" SectionGU="private">
        <Marks>
          <Mark MarkName="Q1" CalculatedScoreString="B" CalculatedScoreRaw="85"/>
          <Mark MarkName="Q2" CalculatedScoreString="A-" CalculatedScoreRaw="92.5">
            <Assignments><Assignment Measure="Private assignment"/></Assignments>
          </Mark>
        </Marks>
      </Course>
      <Course Title="Biology" Period="2"><Marks><Mark CalculatedScoreString="N/A" CalculatedScoreRaw="0"/></Marks></Course>
    </Courses>
  </Gradebook>`);
  global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => text });
  const signal = new AbortController().signal;

  expect(await readLegacyGradebook(credentials, signal)).toEqual({
    status: "ok",
    term: "Q2",
    courses: [
      { name: "Algebra 2", period: "1", mark: "A-", percent: 92.5 },
      { name: "Biology", period: "2", mark: "", percent: null },
    ],
  });
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe("https://sisstudent.fcps.edu/SVUE/Service/PXPCommunication.asmx");
  expect(options).toMatchObject({ method: "POST", redirect: "error", cache: "no-store", credentials: "omit", signal });
  expect(options.body).toContain("<userID>student&amp;1</userID>");
  expect(options.body).toContain("<password>synthetic&lt;password&gt;&amp;</password>");
  expect(options.body).toContain("<skipLoginLog>0</skipLoginLog>");
});

test.each([
  ['<RT_ERROR ERROR_MESSAGE="Invalid user id or password (ID: example)" />', "legacy-sign-in-failed"],
  ['<RT_ERROR ERROR_MESSAGE="Legacy authentication disabled. Use SSO." />', "legacy-retired"],
  ['<Gradebook><Courses /></Gradebook>', "legacy-empty"],
  ['<Gradebook ErrorMessage="unexpected error" />', "legacy-unavailable"],
])("returns a fixed status for %s", async (payload, status) => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => wrap(payload) });
  expect(await readLegacyGradebook(credentials)).toEqual({ status });
});
