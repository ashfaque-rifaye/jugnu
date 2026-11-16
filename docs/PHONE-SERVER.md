# The phone server: a fixed address for calls

Exotel streams each call's audio to one web address. A quick tunnel changes that address on every restart, so Exotel had to be updated each time. The phone server gives it one permanent address.

## What it is

- Jugnu's API on Google Cloud Run, as the service `jugnu-phone` in the project `ai-pro-developer`, region `asia-south1` (Mumbai).
- API only. The web app is not in it, and the live site doesn't change.
- It uses the live Turso database (`jugnu`), so a call placed from the live console is recognised when its audio arrives.
- No passcode anywhere: it can only ring the demo phones in `CALL_ONLY_TO`, so strangers cannot use it to call anyone else.
- It sleeps when idle. Jugnu wakes it just before dialling, so the teacher shouldn't wait in silence.
- It leaves the scheduler and the AI check to the main server, so follow-up calls aren't dialled twice.

**Cost:** Cloud Run charges only while a call or request is running, and its free tier should cover demo use. Storing the image costs a few cents a month.

## Setting it up for the live site (the finals)

The live site places the call; Plivo sends the call's audio to the phone server. Both use the live database, so the interview appears on the live console as it happens.

1. In `.env`, check `DEMO_TEACHER_PHONE` (the phone Jugnu rings on stage) and `PHONE_SALT` are set. `TEST_PHONE` is allowed too.
2. Run `npm run phone:deploy`. It points the phone server at the live database, deploys it, and saves its address as `PHONE_SERVER_URL` in `.env`.
3. Run `npm run env:push`. It gives the live site the Plivo settings, the phone server's address and `CALL_ONLY_TO`: the only numbers the public site may ring, which are the demo phones.
4. Redeploy the live site (`npm run deploy:vercel`), then ask Jugnu on the console to call the teacher.

Anyone else's number is refused on the public site, so a visitor can't use Jugnu to ring strangers.

Run `npm run phone:deploy` again after changing the server code. The address stays the same.

**On the day:** the phone server sleeps when idle and Jugnu wakes it as it dials. To rule out the first few seconds of waking, keep one copy awake for the session: `gcloud run services update jugnu-phone --region asia-south1 --project ai-pro-developer --min-instances 1`, and set it back to `0` afterwards (an awake copy costs a little while it runs).

## Calls from this laptop

`npm run phone:deploy -- --dev` points the phone server at the dev database and saves its address as `PUBLIC_URL`, so `npm run dev` dials through it. For Exotel, put the printed `wss://…/api/ivr/exotel/stream` address in flow 1367051, Voicebot applet, then Save (once).
