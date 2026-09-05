import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Navbar from "./Navbar";
import { DarkModeProvider } from "../context/DarkModeContext";

const user = { uid: "u1", displayName: "Test User", email: "t@example.com" };

const navItems = [
  { id: "work", label: "Work" },
  { id: "tasks", label: "Tasks" },
  { id: "calendar", label: "Calendar" },
];

const setup = (overrides = {}) => {
  const props = {
    activeTab: "work",
    setActiveTab: jest.fn(),
    navItems,
    user,
    onOpenSettings: jest.fn(),
    ...overrides,
  };
  const result = render(
    <DarkModeProvider>
      <Navbar {...props} />
    </DarkModeProvider>
  );
  return { ...result, props };
};

const menuPanel = (container) => container.querySelector(".fixed.inset-x-0");

test("the hamburger is the only way in, and it opens a full-height menu", () => {
  const { container } = setup();

  expect(menuPanel(container)).toBeNull();

  const hamburger = screen.getByRole("button", { name: "Open navigation" });
  expect(hamburger.className).toContain("sm:hidden");

  fireEvent.click(hamburger);

  const panel = menuPanel(container);
  expect(panel).toBeTruthy();
  expect(panel.className).toContain("top-16");
  expect(panel.className).toContain("bottom-0");
  expect(panel.className).toContain("flex-col");
  expect(panel.className).toContain("sm:hidden");
});

test("the close control is the same button in the same place", () => {
  const { container } = setup();

  const hamburger = screen.getByRole("button", { name: "Open navigation" });
  const before = hamburger.className;

  fireEvent.click(hamburger);

  const close = screen.getByRole("button", { name: "Close navigation" });
  expect(close).toBe(hamburger);
  expect(close.className).toBe(before);
  expect(close.querySelector("path").getAttribute("d")).toBe(
    "M6 18L18 6M6 6l12 12"
  );

  fireEvent.click(close);
  expect(menuPanel(container)).toBeNull();
});

test("picking a tab switches to it and closes the menu", () => {
  const { container, props } = setup();

  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));

  const panel = menuPanel(container);
  fireEvent.click(
    Array.from(panel.querySelectorAll("nav button")).find(
      (node) => node.textContent === "Calendar"
    )
  );

  expect(props.setActiveTab).toHaveBeenCalledWith("calendar");
  expect(menuPanel(container)).toBeNull();
});

test("the menu carries every tab plus settings and sign out", () => {
  const { container, props } = setup();

  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  const panel = menuPanel(container);

  navItems.forEach((item) =>
    expect(
      Array.from(panel.querySelectorAll("nav button")).map(
        (node) => node.textContent
      )
    ).toContain(item.label)
  );

  const settings = Array.from(panel.querySelectorAll("button")).find(
    (node) => node.textContent === "Settings"
  );
  fireEvent.click(settings);
  expect(props.onOpenSettings).toHaveBeenCalled();
  expect(menuPanel(container)).toBeNull();
});

test("escape closes the menu and the page scrolls again", () => {
  const { container } = setup();

  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  expect(document.body.style.overflow).toBe("hidden");

  fireEvent.keyDown(window, { key: "Escape" });
  expect(menuPanel(container)).toBeNull();
  expect(document.body.style.overflow).not.toBe("hidden");
});
