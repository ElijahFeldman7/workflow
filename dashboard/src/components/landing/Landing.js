import React from "react";
import { Link } from "react-router-dom";
import { signInWithGoogle } from "../../firebase";
import { MockCapture, MockWorkList, MockCalendar } from "./Mockups";

const Section = ({ title, blurb, children, reverse }) => (
  <section className="py-14 border-t border-border">
    <div
      className={`grid gap-10 lg:grid-cols-2 lg:items-center ${
        reverse ? "lg:[&>*:first-child]:order-2" : ""
      }`}
    >
      <div className="max-w-md">
        <h2 className="text-2xl font-medium text-foreground">{title}</h2>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          {blurb}
        </p>
      </div>
      <div>{children}</div>
    </div>
  </section>
);

const Landing = () => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img className="h-8 w-8" src="/logo.png" alt="" />
        <span className="text-lg font-semibold tracking-tight">Workflow</span>
      </div>
      <button
        onClick={signInWithGoogle}
        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Sign in
      </button>
    </header>

    <main className="max-w-5xl mx-auto px-6">
      <section className="py-16 lg:py-24">
        <h1 className="text-4xl sm:text-5xl font-medium tracking-tight leading-[1.1] max-w-2xl">
          School, in one place, without the setup.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-xl leading-relaxed">
          Type what you have to do the way you would say it. Workflow reads the
          class, the kind of work, the priority and the date, then files it and
          puts it on your calendar.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            onClick={signInWithGoogle}
            className="bg-primary text-primary-foreground px-5 py-2.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Continue with Google
          </button>
          <span className="text-sm text-muted-foreground">
            Free, and your data stays in your own account.
          </span>
        </div>

        <div className="mt-14 max-w-2xl">
          <MockCapture />
        </div>
      </section>

      <Section
        title="Everything you owe, grouped by when it matters."
        blurb="Overdue, today, tomorrow, later. Tick something off and it stays where it is, so the click always has a visible result. Edit any field in place without opening a dialog."
      >
        <MockWorkList />
      </Section>

      <Section
        title="One calendar for coursework and everything else."
        blurb="Deadlines and events share a month and week view, and your tasks land there too. Connect Google Calendar and it syncs both ways, so an edit in either place shows up in the other."
        reverse
      >
        <MockCalendar />
      </Section>

      <Section
        title="It learns the words you actually use."
        blurb="Correct a guess once and Workflow remembers the phrase. Call it ochem and it will keep filing ochem under the right class, even though nothing in the name matches."
      >
        <div className="rounded-xl border border-border bg-card shadow-sm p-6">
          <p className="text-sm text-muted-foreground">You type</p>
          <p className="mt-1 text-sm text-foreground">ochem pset due tues</p>
          <p className="mt-5 text-sm text-muted-foreground">You get</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              Organic Chemistry
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              Homework
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              Tuesday
            </span>
          </div>
        </div>
      </Section>

      <section className="py-14 border-t border-border">
        <h2 className="text-2xl font-medium">Ready when you are.</h2>
        <p className="mt-3 text-base text-muted-foreground max-w-lg leading-relaxed">
          Sign in with the Google account you already use for school. There is
          nothing to configure and nothing to import.
        </p>
        <button
          onClick={signInWithGoogle}
          className="mt-6 bg-primary text-primary-foreground px-5 py-2.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Continue with Google
        </button>
      </section>
    </main>

    <footer className="border-t border-border mt-10">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>Workflow</span>
        <nav className="flex items-center gap-6">
          <Link to="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  </div>
);

export default Landing;
