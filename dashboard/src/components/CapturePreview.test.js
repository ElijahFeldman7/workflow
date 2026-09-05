import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CapturePreview from "./CapturePreview";
import { captureText } from "../lib/capture/capture";

const now = new Date(2026, 8, 5);
const spaces = [
  { id: "s1", name: "AP Biology", kind: "class", color: "emerald" },
  { id: "s2", name: "Ceramics", kind: "class", color: "rose" },
];

const setup = (text, onCorrect = jest.fn()) => {
  const parsed = captureText(text, { spaces, now });
  render(
    <CapturePreview
      parsed={parsed}
      spaces={spaces}
      colors={false}
      onCorrect={onCorrect}
    />
  );
  return { parsed, onCorrect };
};

test("shows nothing when nothing was understood", () => {
  const { container } = render(
    <CapturePreview
      parsed={captureText("some plain words", { spaces, now })}
      spaces={spaces}
      colors={false}
      onCorrect={jest.fn()}
    />
  );
  expect(container).toBeEmptyDOMElement();
});

test("shows a chip for each field it understood", () => {
  setup("cell lab writeup bio friday !!!");
  expect(screen.getByRole("button", { name: /Class: AP Biology/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Type: Lab/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Priority: High/ })).toBeInTheDocument();
  expect(screen.getByText("Friday")).toBeInTheDocument();
});

test("marks a confident field as sure and an uncertain one as unsure", () => {
  setup("essay #bio friday");
  const confident = screen.getByRole("button", { name: /Class: AP Biology/ });
  expect(confident.className).not.toMatch("border-dashed");
});

test("an uncertain guess is drawn as correctable", () => {
  const parsed = captureText("bioloy essay tomorrow", { spaces, now });
  expect(parsed.confidence.space).toBeLessThan(0.8);

  render(
    <CapturePreview
      parsed={parsed}
      spaces={spaces}
      colors={false}
      onCorrect={jest.fn()}
    />
  );
  expect(
    screen.getByRole("button", { name: /Class: AP Biology/ }).className
  ).toMatch("border-dashed");
});

test("clicking a chip offers the other choices and reports the correction", () => {
  const onCorrect = jest.fn();
  setup("bioloy essay tomorrow", onCorrect);

  fireEvent.click(screen.getByRole("button", { name: /Class: AP Biology/ }));
  fireEvent.mouseDown(screen.getByRole("button", { name: "Ceramics" }));

  expect(onCorrect).toHaveBeenCalledWith("space", "s2");
});

test("a class can be cleared back to none", () => {
  const onCorrect = jest.fn();
  setup("bioloy essay tomorrow", onCorrect);

  fireEvent.click(screen.getByRole("button", { name: /Class: AP Biology/ }));
  fireEvent.mouseDown(screen.getByRole("button", { name: "No class" }));

  expect(onCorrect).toHaveBeenCalledWith("space", "");
});

test("the date chip is informational, not a control", () => {
  setup("essay friday");
  const chip = screen.getByText("Friday");
  expect(chip.tagName).toBe("SPAN");
  expect(screen.queryByRole("button", { name: /When/ })).not.toBeInTheDocument();
});

test("a brand new class is shown as an addition and cannot be reassigned", () => {
  setup("essay #Pottery friday");
  expect(screen.getByText("+ Pottery")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Class: \+ Pottery/ })
  ).not.toBeInTheDocument();
});

test("an event shows a kind chip that can be switched back to a due date", () => {
  const onCorrect = jest.fn();
  setup("club meeting 3-5pm friday", onCorrect);

  fireEvent.click(screen.getByRole("button", { name: /Kind: Event/ }));
  fireEvent.mouseDown(screen.getByRole("button", { name: "Due date" }));

  expect(onCorrect).toHaveBeenCalledWith("mode", "due");
});
