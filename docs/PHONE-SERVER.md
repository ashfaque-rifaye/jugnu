# The phone server: a fixed address for calls

Exotel streams each call's audio to one web address. A quick tunnel changes that address on every restart, so Exotel had to be updated each time. The phone server gives it one permanent address.

## What it is

- Jugnu's API on Google Cloud Run, as the service `jugnu-phone` in the project `ai-pro-developer`, region `asia-south1` (Mumbai).
- API only. The web app is not in it, and the live site doesn't change.
- It uses the same Turso database, so a call placed from the console is recognised when its audio arrives.
- Officer routes need a passcode, kept in `.env` as `PHONE_SERVER_PASSCODE`, so strangers can't place calls through it.
- It sleeps when idle. Jugnu wakes it just before dialling, so the teacher shouldn't wait in silence.
- It leaves the scheduler and the AI check to the main server, so follow-up calls aren't dialled twice.

**Cost:** Cloud Run charges only while a call or request is running, and its free tier should cover demo use. Storing the image costs a few cents a month.

## Setting it up

1. Run `npm run phone:deploy`. It prints the fixed address and saves it as `PUBLIC_URL` in `.env`.
2. Put the printed `wss://…/api/ivr/exotel/stream` address in Exotel: flow 1367051, Voicebot applet, then Save. This is needed only once.
3. Restart the app, then place a test call.

Run `npm run phone:deploy` again after changing the server code. The address stays the same.
