# TruthSpine for Claude

The keeper of your project. One checked record of what was decided, what was done, what failed and what comes next. Every connected chat starts already knowing your project. Your project stays on your computer. You lead the work. TruthSpine keeps the truth.

This is the free connector. It needs the TruthSpine desktop app installed on the same computer: Microsoft Store on Windows, Mac App Store on macOS, or the AppImage from truthspine.app on Linux.

## Setup

1. Install and open the TruthSpine app, and connect your project folder in it.
2. Add this plugin: in Claude Code run `/plugin marketplace add TimeProofLabs/truthspine-app`, then `/plugin install truthspine@timeprooflabs`; or add it from the Claude directory.
3. Open your project and say "Attach TruthSpine".

## Tools

- `truthspine_attach`: Attach this chat to the project's TruthSpine record and receive the current brief: decisions, completed work, evidence and next steps.
- `truthspine_consult`: Ask what is true about the project, what was decided and why, or what to do next. Read only.
- `truthspine_record`: Save a decision, finished work, a failure or the next step to the project's record on this computer.
- `truthspine_history`: Read what was saved recently, or confirm that a save was recorded. Read only.

## Licence

This connector is free (Apache License 2.0). It needs the TruthSpine app, which you get and buy separately.
Installing the connector does not start a trial or need its own license.
On Windows, start the free 14-day trial in the TruthSpine app. Then buy once in the Microsoft Store: $99.99 at the launch price (regular price $249.99), for V1 and every 1.x update. Reinstalling does not restart the trial.
On Mac, start the free 14-day trial in the TruthSpine app. Then buy once in the App Store: $99.99 at the launch price (regular price $249.99), for V1 and every 1.x update. Restore Purchases brings it back on your other Macs.
On Linux, the TruthSpine AppImage from truthspine.app starts with a free 14-day trial. Then buy once from us: $99.99 at the launch price (regular price $249.99), for V1 and every 1.x update, on up to three of your own Linux computers. You can move it between them in the app.

## Privacy Policy

Full policy: https://truthspine.app/privacy

- **What is collected:** this connector collects nothing itself. It starts the TruthSpine app installed on your computer and passes your agent's requests to it.
- **Use and storage:** the TruthSpine app keeps your project record (decisions, completed work, evidence references and next steps) in its data folder on your computer. Project files are read on your computer and are not uploaded by TruthSpine.
- **Third-party sharing:** none by this connector. What your agent shows or sends to its own AI provider is governed by that provider. The app contacts TimeProofLabs only for licence checks and, if you agree to it, anonymous usage counts. Purchases go through Microsoft, Apple or Stripe. Optional features you turn on, such as remote access or GitHub projects, connect only to accounts you choose.
- **Retention:** the record stays on your computer until you delete the project or the app's data; you can download or delete it at any time from the app.
- **Contact:** support@truthspine.app

Support: https://truthspine.app/support
