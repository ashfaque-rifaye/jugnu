# WhatsApp for Jugnu: setting it up for the finals

Jugnu's WhatsApp code is finished: it sends the 60-second peer voice note as a real WhatsApp voice
message, asks the day-14 "did you try it?" question, and reads the teacher's reply (typed or spoken).
The reply lands on the plan board, and a problem becomes an escalation, the same as the phone call.
The only thing missing is a Meta WhatsApp number. These steps take about 20 minutes and cost nothing.
On the live site, WhatsApp can only send to the demo phones (`CALL_ONLY_TO`), the same rule as calls.

## 1. Make the Meta app (owner, in a browser)

1. Open https://business.facebook.com and create a **business portfolio** (name: ShikshaSaathi AI).
2. Open https://developers.facebook.com/apps → **Create app** → use case
   **"Connect with customers through WhatsApp"** → choose the portfolio from step 1.
3. In the app, open **WhatsApp → API Setup**. Meta gives a free **test number**.
   - Copy the **Phone number ID** (not the number itself).
   - Under **To**, add each demo phone and confirm it with the code Meta sends to it (up to 5 numbers).
   - Press **Send message** once: the demo phone should get Meta's "Hello World". That proves the line works.

## 2. A token that does not expire

The token on the API Setup page lasts 24 hours. For the finals, make one that lasts:

1. https://business.facebook.com → **Settings → Users → System users → Add** (Admin).
2. **Add assets** → the app → full control. Then **Generate token** → the app → expiry **Never** →
   tick `whatsapp_business_messaging` and `whatsapp_business_management`.
3. **App settings → Basic** in the developer app: copy the **App secret**.

## 3. Put the values in `.env` and push them

```
WHATSAPP_TOKEN=<the system user token>
WHATSAPP_PHONE_NUMBER_ID=<phone number id>
WHATSAPP_VERIFY_TOKEN=<any long random words you make up>
WHATSAPP_APP_SECRET=<app secret>
WHATSAPP_TEMPLATE=hello_world
WHATSAPP_TEMPLATE_LANG=en_US
WHATSAPP_TEMPLATE_VARS=0
```

Then run, in this order:

```bash
npm run env:push
```

```bash
npm run deploy:vercel
```

## 4. Let Meta tell Jugnu about replies

In the developer app: **WhatsApp → Configuration → Webhook → Edit**

- Callback URL: `https://jugnu-nine.vercel.app/api/whatsapp/webhook`
- Verify token: the same words as `WHATSAPP_VERIFY_TOKEN`
- Press **Verify and save**, then **Manage** → subscribe to **messages**.

## 5. On the morning of the demo (important)

WhatsApp lets a business send ordinary messages and voice notes only within 24 hours of the person
writing to it. So, **from each demo phone, send "Hi" to the test number** on the morning of the demo.
After that, everything below works for 24 hours.

## 6. Try it (2 minutes)

1. Open a school that has a plan (for example from **Share with schools**), go to its voice note.
2. **Send to … on WhatsApp**, enter the demo phone → the phone gets Jugnu's voice note and its words.
3. **Ask the day-14 question on WhatsApp** → the phone gets the question.
4. Reply from the phone, by voice note or text ("Haan, maine try kiya, bachche ab zyada padh rahe hain").
5. Within a few seconds the plan board shows the outcome, and Jugnu replies "Thank you! Your CRP will see this today."
   If the reply names a problem, it becomes an escalation for the BEO.

If anything fails, the app shows Meta's own error message under the button.
