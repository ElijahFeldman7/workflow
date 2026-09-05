import React from "react";
import LegalPage, { Paragraph, Heading, List } from "./LegalPage";

const Terms = () => (
  <LegalPage title="Terms of Service" updated="September 5, 2026">
    <Paragraph>
      These terms cover your use of Workflow, a personal school planner. By
      signing in you agree to them. If you do not agree, please do not use the
      app.
    </Paragraph>

    <Heading>What Workflow is</Heading>
    <Paragraph>
      Workflow is a free tool for tracking coursework, tasks, notes, and habits,
      with an optional two way connection to Google Calendar. It is a personal
      project, offered as is, and it is not affiliated with, endorsed by, or
      operated on behalf of any school, district, or university.
    </Paragraph>

    <Heading>Your account</Heading>
    <Paragraph>
      You sign in with Google, and you are responsible for that Google account
      and for everything done through it in Workflow. You must be at least 13
      years old to use the app. Keep your sign in secure, and tell us if you
      believe someone else has reached your account.
    </Paragraph>

    <Heading>Your content stays yours</Heading>
    <Paragraph>
      Everything you put into Workflow belongs to you. We claim no ownership of
      it. We store and display it only so the app can work for you, and we do
      not use it to train anything or show it to anyone else.
    </Paragraph>
    <Paragraph>
      You are responsible for what you store. Please do not use Workflow to hold
      anything unlawful, or anything you do not have the right to keep.
    </Paragraph>

    <Heading>Acceptable use</Heading>
    <List
      items={[
        "Do not try to reach another person's data, or probe the service for weaknesses in order to exploit them.",
        "Do not use the service to break the law or a school policy that applies to you.",
        "Do not automate the app in a way that degrades it for other people.",
        "Do not resell the service or present it as your own product.",
      ]}
    />
    <Paragraph>
      If you find a security problem, please report it rather than using it.
      Good faith reports are welcome.
    </Paragraph>

    <Heading>Google Calendar</Heading>
    <Paragraph>
      If you connect Google Calendar, you are giving Workflow permission to read
      the calendar you select and to create, change, and delete events that it
      manages there. Syncing runs in both directions, so a change you make in
      either place can overwrite the other. Please review what syncs before you
      connect a shared or important calendar. You can disconnect at any time in
      Settings, and doing so leaves the events already written in place.
    </Paragraph>

    <Heading>Availability</Heading>
    <Paragraph>
      Workflow is provided free and without a service commitment. It may be
      slow, unavailable, or changed at any time, and features may be added or
      removed. Keep your own copy of anything you cannot afford to lose.
    </Paragraph>

    <Heading>No warranty</Heading>
    <Paragraph>
      The service is provided as is and as available, without warranties of any
      kind, whether express or implied, including any implied warranty of
      merchantability, fitness for a particular purpose, or non infringement. We
      do not promise the app will be error free, that it will read what you type
      correctly, or that it will keep your data without loss.
    </Paragraph>

    <Heading>Limitation of liability</Heading>
    <Paragraph>
      To the fullest extent the law allows, we are not liable for any indirect,
      incidental, special, or consequential damages, or for lost data, missed
      deadlines, or lost grades arising from your use of Workflow. Workflow is a
      planning aid, not a system of record. Please confirm anything that matters
      against the official sources your school publishes.
    </Paragraph>

    <Heading>Ending your use</Heading>
    <Paragraph>
      You can stop using Workflow at any time by signing out and requesting
      deletion of your data, as described in the Privacy Policy. We may suspend
      or end access to an account that breaks these terms or puts the service or
      its other users at risk.
    </Paragraph>

    <Heading>Changes to these terms</Heading>
    <Paragraph>
      These terms may change. When they do, the date at the top will change and
      the updated version will be posted here. Continuing to use Workflow after
      that means you accept the new version.
    </Paragraph>

    <Heading>Contact</Heading>
    <Paragraph>
      Questions about these terms can go to the maintainer of this project
      through the repository it is published from.
    </Paragraph>
  </LegalPage>
);

export default Terms;
