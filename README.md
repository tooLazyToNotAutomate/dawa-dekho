# Dawa Dekho – prototype (working title)

Two small web apps that share one demo data store. No build step, no paid services.

| | Who | Open |
|---|---|---|
| **Patient app (PWA)** | Patients pick their clinic, then see live status, medicines, book a visit or online checkup, ask questions, view records | `index.html` |
| **Clinic dashboard** | Clinic staff (login) update open/closed, doctor present, stock; confirm bookings; reply to questions | `clinic/index.html` |
| **Side-by-side demo** | For the jury: phone + dashboard on one screen, live-synced | `demo.html` |

## Run it
Browsers block JavaScript modules from `file://`, so serve the folder:

* **On your laptop:** in this folder run `python -m http.server 8000`, then open `http://localhost:8000/demo.html`.
* **Free hosting (so jury can open it on their phones):** drag the whole folder onto https://app.netlify.com/drop, or push it to GitHub and turn on GitHub Pages. Cloudflare Pages and Vercel also work. It is plain static files.

## Demo logins (clinic dashboard)
Usernames `suncity`, `kismatpur`, `moulali`, `madhuranagar`. Password for all: `demo123`.

## What works
* Patient app: choose clinic (remembered), open/closed + doctor present + "last updated", Google address and Maps link, call button, other open clinics suggested when yours is closed, medicine stock with search and filters, book a visit or an online (phone) checkup with real 30-minute slots, ask a question, records of appointments and replies, English / తెలుగు switch, installable and works offline for the shell.
* Dashboard: login, big open/doctor switches, "status is still correct" confirm, stock In/Low/Out per medicine, confirm/cancel/complete bookings with a note to the patient, reply to questions, edit address / Maps link / phone / hours / weekly off, language switch, reset demo data.
* A status not updated for 24 hours is shown to patients as "Not updated recently – please call before you go".

## Honest limits of this prototype
* **Data lives in the browser (localStorage).** Two windows on the *same browser* stay in sync live (that is what `demo.html` uses). Different devices do **not** share data yet. For a multi-device pilot, swap `load / update` in `assets/js/core.js` for a cloud database (Firebase or Supabase free tier). Everything else stays the same.
* **Logins are demo-only.** Passwords sit in the demo data; real staff login needs a backend (Firebase Auth / Supabase Auth).
* Clinic names/areas come from our research; addresses, phone numbers, hours, stock and patients are **made-up demo data**.
* Telugu text should be checked by a native speaker before the jury.
* No SMS/WhatsApp/Telegram bot and no community verification in this prototype; clinics update their own status.

## Change things
* App name: `assets/js/config.js` (and the name in the two `manifest.webmanifest` files and `<title>` tags).
* Clinics, medicines, sample bookings: `assets/js/data.js`.
* All text in both languages: `assets/js/i18n.js`.
* Colours and layout: `assets/css/app.css`.
