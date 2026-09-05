import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Landing from "./Landing";
import Terms from "../../pages/Terms";
import Privacy from "../../pages/Privacy";
import { signInWithGoogle } from "../../firebase";

jest.mock("../../firebase", () => ({
  signInWithGoogle: jest.fn(),
  auth: {},
  database: {},
}));

const show = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("landing page", () => {
  test("leads with what the product does", () => {
    show(<Landing />);
    expect(
      screen.getByRole("heading", { level: 1, name: /School, in one place/i })
    ).toBeInTheDocument();
  });

  test("every sign in control starts the Google flow", () => {
    show(<Landing />);
    const buttons = screen.getAllByRole("button", { name: /Google|Sign in/i });
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    buttons.forEach((button) => fireEvent.click(button));
    expect(signInWithGoogle).toHaveBeenCalledTimes(buttons.length);
  });

  test("shows the product rather than only describing it", () => {
    const { container } = show(<Landing />);
    expect(screen.getByText("cell lab writeup for bio due friday")).toBeInTheDocument();
    expect(screen.getByText("Cell lab writeup")).toBeInTheDocument();
    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(container.querySelectorAll(".rounded-xl.border").length).toBeGreaterThanOrEqual(3);
  });

  test("links to the legal pages", () => {
    show(<Landing />);
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  });

  test("avoids the uppercase letterspaced label style", () => {
    const { container } = show(<Landing />);
    expect(container.querySelectorAll(".uppercase")).toHaveLength(0);
    expect(container.querySelectorAll(".tracking-widest")).toHaveLength(0);
  });

  test("uses the theme tokens so it follows light, dark and every palette", () => {
    const { container } = show(<Landing />);
    expect(container.querySelectorAll("[class*='bg-white'], [class*='bg-gray-']")).toHaveLength(0);
    expect(container.querySelector(".bg-background")).toBeTruthy();
  });
});

describe("legal pages", () => {
  test("terms states the important limits", () => {
    show(<Terms />);
    expect(screen.getByRole("heading", { name: "Terms of Service" })).toBeInTheDocument();
    expect(screen.getByText(/at least 13 years old/i)).toBeInTheDocument();
    expect(screen.getByText(/without warranties of any/i)).toBeInTheDocument();
    expect(screen.getByText(/not affiliated with, endorsed by/i)).toBeInTheDocument();
  });

  test("privacy describes what the code actually does", () => {
    show(<Privacy />);
    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText(/Firebase Realtime Database/i)).toBeInTheDocument();
    expect(screen.getByText(/session storage only/i)).toBeInTheDocument();
    expect(screen.getByText(/analytics library is never loaded/i)).toBeInTheDocument();
    expect(screen.getByText(/entirely in your browser/i)).toBeInTheDocument();
  });

  test("neither document uses an em dash", () => {
    const terms = show(<Terms />);
    expect(terms.container.textContent).not.toMatch(/—/);
    terms.unmount();

    const privacy = show(<Privacy />);
    expect(privacy.container.textContent).not.toMatch(/—/);
  });

  test("both pages link back and to each other", () => {
    show(<Privacy />);
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  });
});
