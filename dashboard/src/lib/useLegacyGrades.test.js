import { act, renderHook } from "@testing-library/react";
import { readLegacyGradebook } from "./studentvueLegacy";
import { useLegacyGrades } from "./useLegacyGrades";

jest.mock("./studentvueLegacy");

const interval = 5 * 60 * 1000;
const username = "demo-id";
const password = "demo-secret";
const success = { status: "ok", courses: [], term: "Q2" };

beforeEach(() => {
  jest.useFakeTimers();
  readLegacyGradebook.mockReset().mockResolvedValue(success);
});

afterEach(() => jest.useRealTimers());

test("refreshes only on the grades tab and drops the connection on disconnect", async () => {
  const onResult = jest.fn();
  const { result, rerender } = renderHook(({ active }) => useLegacyGrades({ active, onResult }), {
    initialProps: { active: true },
  });

  await act(async () => result.current.connect(username, password));
  expect(result.current.connected).toBe(true);
  expect(onResult).toHaveBeenCalledWith(success);
  expect(readLegacyGradebook).toHaveBeenCalledTimes(1);

  await act(async () => jest.advanceTimersByTime(interval));
  expect(readLegacyGradebook).toHaveBeenCalledTimes(2);
  expect(readLegacyGradebook.mock.calls[1][0]).toEqual({ username, password });

  rerender({ active: false });
  await act(async () => jest.advanceTimersByTime(interval * 2));
  expect(readLegacyGradebook).toHaveBeenCalledTimes(2);

  rerender({ active: true });
  await act(async () => jest.advanceTimersByTime(1000));
  expect(readLegacyGradebook).toHaveBeenCalledTimes(3);

  act(() => result.current.disconnect());
  await act(async () => jest.advanceTimersByTime(interval * 2));
  expect(result.current.connected).toBe(false);
  expect(readLegacyGradebook).toHaveBeenCalledTimes(3);
});

test("stops automatic refresh when FCPS rejects the credentials", async () => {
  const onResult = jest.fn();
  const { result } = renderHook(() => useLegacyGrades({ active: true, onResult }));
  await act(async () => result.current.connect(username, password));
  readLegacyGradebook.mockResolvedValue({ status: "legacy-sign-in-failed" });
  await act(async () => jest.advanceTimersByTime(interval));
  expect(result.current.connected).toBe(false);
  expect(onResult).toHaveBeenLastCalledWith({ status: "legacy-sign-in-failed" });
  await act(async () => jest.advanceTimersByTime(interval * 2));
  expect(readLegacyGradebook).toHaveBeenCalledTimes(2);
});
