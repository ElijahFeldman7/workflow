import React from "react";
import LegalPage, { Paragraph, Heading, List } from "./LegalPage";

const Privacy = () => (
  <LegalPage title="Privacy Policy" updated="November 23, 2026">
    <Paragraph>
      Workflow is a personal school planner. This policy explains what the app
      stores, where it goes, and how to get rid of it. It is written to describe
      what the software actually does rather than to cover every situation a
      lawyer might imagine.
    </Paragraph>

    <Heading>What we collect</Heading>
    <Paragraph>
      You sign in with Google. From that sign in we receive and store your
      display name, your email address, and your profile photo URL. We never see
      or store your Google password.
    </Paragraph>
    <Paragraph>Everything else is content you type into the app:</Paragraph>
    <List
      items={[
        "Work items: titles, classes, types, priorities, dates, times, locations, and notes.",
        "Tasks: titles, dates, times, and priorities.",
        "Classes and clubs, including any teacher or room you add.",
        "Notes, habits, and quick links.",
        "Capture corrections: when you fix a field the app guessed wrong, the phrase and the correct value are saved so the guess improves next time.",
      ]}
    />

    <Heading>Where it is stored</Heading>
    <Paragraph>
      Your content is stored in Google Firebase Realtime Database under a path
      keyed to your account, and it is readable only by your signed in account.
      Firebase is operated by Google, which acts as our only service provider.
    </Paragraph>
    <Paragraph>
      Some preferences never leave your device. Your dark mode choice, color
      theme, work view settings, Grades tab and graph preferences, and timer durations live in your browser local
      storage. Clearing your browser data resets them.
    </Paragraph>

    <Heading>StudentVUE grade book</Heading>
    <Paragraph>
      If you choose legacy sign-in, your browser sends your FCPS student ID and
      password directly to FCPS. Workflow servers and Firebase do not receive
      them. Workflow keeps them in the open browser page’s memory to refresh
      your grades while you view the Grades tab. Disabling the tab, disconnecting,
      signing out, closing the page, or reloading clears them from that memory.
      Course and assignment grades and score edits stay in page memory. Score
      edits are used only to calculate projections in Workflow. You may also
      let your browser’s password manager save and autofill the credentials.
      Your browser controls saved logins. Workflow remembers whether to
      reconnect in this browser without saving the student ID or password.
      Teacher comments displayed with assignments also stay in page memory.
    </Paragraph>
    <Paragraph>
      Workflow adds StudentVUE course names to Classes for the current school
      year. These class records and their school year are saved in your Workflow
      account so assignment capture can use them. Grade and assignment scores
      stay in the browser.
    </Paragraph>
    <Paragraph>
      The optional browser companion reads course names, periods, grades, and
      the selected term from the StudentVUE grade book open in your browser.
      With the companion, you sign in directly on the FCPS website. When you
      request grades, the companion
      passes only those course details to the Workflow tab on the same device.
      Workflow keeps them in memory for up to 15 minutes, or until you clear
      them, sign out, or close or reload the tab. Grades and score edits
      are never uploaded to Workflow servers or Firebase.
    </Paragraph>

    <Heading>Google Calendar</Heading>
    <Paragraph>
      Connecting Google Calendar is optional and off until you turn it on. If you
      connect it, you grant read-only access to your calendars, which lets
      Workflow show events from the calendar you choose. It cannot create,
      change, or delete anything in Google Calendar.
    </Paragraph>
    <List
      items={[
        "The access token is held in your browser session storage only. It is never written to our database and it disappears when you close the tab.",
        "We store the calendar you picked, when it was last read, and a copy of that calendar's events from roughly the last three months and the next four so they can be shown without asking Google each time.",
        "Disconnecting in Settings clears the token and deletes that copy.",
        "Workflow's use of information received from Google APIs follows the Google API Services User Data Policy, including its Limited Use requirements.",
      ]}
    />

    <Heading>Smarter capture</Heading>
    <Paragraph>
      Reading what you type happens entirely in your browser. The default parser
      is plain code with no network access. If you turn on Smarter Capture, the
      app downloads a language model once and then runs it locally. In neither
      case is the text you type sent to us or to any third party for analysis.
    </Paragraph>

    <Heading>What we do not do</Heading>
    <List
      items={[
        "We do not sell or rent your information.",
        "We do not share your content with anyone, and there is no way for another Workflow user to see it.",
        "We do not run analytics or advertising trackers. The Firebase configuration includes an analytics identifier, but the analytics library is never loaded and no events are recorded.",
        "We do not send you marketing email.",
      ]}
    />

    <Heading>Deleting your data</Heading>
    <Paragraph>
      You can delete any item, task, note, class, habit, or link from inside the
      app, and deletion is immediate. To remove everything, disconnect Google
      Calendar in Settings, then email the address below and ask for account
      deletion. We will delete your stored content and confirm when it is done.
      You can also revoke access for Workflow at any time from the
      permissions page of your Google account.
    </Paragraph>

    <Heading>Keeping it safe</Heading>
    <Paragraph>
      Traffic is encrypted in transit, and database rules restrict each account
      to its own data. No system is perfect, so please do not store anything in
      Workflow that would be harmful if it were exposed.
    </Paragraph>

    <Heading>Age</Heading>
    <Paragraph>
      Workflow is meant for students aged 13 and over. If you are under 13,
      please do not create an account. If we learn that we hold data for someone
      under 13, we will delete it.
    </Paragraph>

    <Heading>Changes</Heading>
    <Paragraph>
      If this policy changes in a way that affects what we collect or who we
      share it with, the date at the top will change and the new version will be
      posted here before it takes effect.
    </Paragraph>

    <Heading>Contact</Heading>
    <Paragraph>
      Questions, corrections, or deletion requests can go to the maintainer of
      this project through the repository it is published from.
    </Paragraph>
  </LegalPage>
);

export default Privacy;
