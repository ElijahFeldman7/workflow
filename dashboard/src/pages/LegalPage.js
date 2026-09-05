import React from "react";
import { Link } from "react-router-dom";

export const Paragraph = ({ children }) => (
  <p className="text-[15px] leading-relaxed text-muted-foreground mb-4">
    {children}
  </p>
);

export const Heading = ({ children }) => (
  <h2 className="text-lg font-medium text-foreground mt-10 mb-3">{children}</h2>
);

export const List = ({ items }) => (
  <ul className="mb-4 space-y-2">
    {items.map((item, index) => (
      <li
        key={index}
        className="text-[15px] leading-relaxed text-muted-foreground pl-4 relative"
      >
        <span className="absolute left-0 top-[0.6em] h-1 w-1 rounded-full bg-muted-foreground/50" />
        {item}
      </li>
    ))}
  </ul>
);

const LegalPage = ({ title, updated, children }) => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-3">
        <img className="h-7 w-7" src="/logo.png" alt="" />
        <span className="text-base font-semibold tracking-tight">Workflow</span>
      </Link>
      <Link
        to="/"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Back
      </Link>
    </header>

    <main className="max-w-2xl mx-auto px-6 pb-20">
      <h1 className="text-3xl font-medium tracking-tight mt-8">{title}</h1>
      <p className="text-sm text-muted-foreground mt-2 mb-8">
        Last updated {updated}
      </p>
      {children}
    </main>

    <footer className="border-t border-border">
      <div className="max-w-2xl mx-auto px-6 py-8 flex items-center gap-6 text-sm text-muted-foreground">
        <Link to="/terms" className="hover:text-foreground transition-colors">
          Terms
        </Link>
        <Link to="/privacy" className="hover:text-foreground transition-colors">
          Privacy
        </Link>
      </div>
    </footer>
  </div>
);

export default LegalPage;
