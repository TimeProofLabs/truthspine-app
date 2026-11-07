# TruthSpine for Claude

Stop re-explaining your project to every new AI chat. It works on your computer, with no cloud account and nothing extra to install.

One checked record of what was decided, what was done, what failed and what comes next. Every connected chat checks your project before it answers, so you never re-explain it. Your project stays on your computer.

This is the free connector. It needs the TruthSpine desktop app installed on the same computer: Microsoft Store on Windows, Mac App Store on macOS, or the AppImage from truthspine.app on Linux.

## Setup

1. Install and open the TruthSpine app, and connect your project folder in it.
2. Add this plugin: in Claude Code run `/plugin marketplace add TimeProofLabs/truthspine-app`, then `/plugin install truthspine@timeprooflabs`; or add it from the Claude directory.
3. Open your project and say "Connect TruthSpine".

## Tools

- `attach`: Attach this chat to the project's TruthSpine record and receive the current brief: decisions, completed work, evidence and next steps.
- `consult`: Ask what is true about the project, what was decided and why, or what to do next. Read only.
- `record`: Save a decision, finished work, a failure or the next step to the project's record on this computer.
- `history`: Read what was saved recently, or confirm that a save was recorded. Read only.

## Licence

This connector is open source (Apache License 2.0). It needs the TruthSpine app, which you get separately.
The connector needs no license of its own.
On Windows, get the TruthSpine app from the Microsoft Store.
On Mac, get the TruthSpine app from the App Store.
On Linux, get the TruthSpine AppImage from truthspine.app.

## Privacy Policy

Full policy: https://truthspine.app/privacy

- **What is collected:** this connector collects nothing itself. It starts the TruthSpine app installed on your computer and passes your agent's requests to it.
- **Use and storage:** the TruthSpine app keeps your project record (decisions, completed work, evidence references and next steps) in its data folder on your computer. Project files are read on your computer and are not uploaded by TruthSpine.
- **Third-party sharing:** none by this connector. What your agent shows or sends to its own AI provider is governed by that provider. The app contacts TimeProofLabs only for licence checks and, if you agree to it, anonymous usage counts. Purchases go through Microsoft, Apple or Stripe. Optional features you turn on, such as remote access or GitHub projects, connect only to accounts you choose.
- **Retention:** the record stays on your computer until you delete the project or the app's data; you can download or delete it at any time from the app.
- **Contact:** support@truthspine.app

Support: https://truthspine.app/support
