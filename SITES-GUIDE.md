# Amja — two websites, one admin panel

| Folder | Website | Pages |
|---|---|---|
| `inbound/` | **Amja Tours** — Sri Lanka inbound | Home · Plan a trip (tour planner) · Hotels · Rent a car · Our story · Contact · **Admin** (`/admin/`) |
| `outbound/` | **Amja Travels** — outbound | Home · Hajj · Umrah · Air tickets · Our story · Contact |
| `shared/` | Code used by both sites | edit here, then run `node scripts/sync-shared.mjs` |

Both sites read the same Firebase project (`amjaa-travels`). The single admin panel lives on the inbound site and controls everything on both.
The old combined site in `public/` is left untouched and is no longer deployed.

## Preview on your computer

```powershell
cd "C:\Users\oshan\Documents\PROJECTS\AMJAA TRAVELS"
node scripts/sync-shared.mjs
npx serve inbound -l 5000      # Amja Tours   → http://localhost:5000
npx serve outbound -l 5001     # Amja Travels → http://localhost:5001  (second terminal)
```

## Deploy (free Spark plan — no server, no card)

One-time: create the second hosting site for the outbound brand.

```powershell
firebase hosting:sites:create amjaa-travels-outbound
```

If that name is taken, pick another, then change `amjaa-travels-outbound` in `.firebaserc` to your name.

Every deploy:

```powershell
node scripts/sync-shared.mjs
firebase deploy --only hosting,firestore:rules
```

* Amja Tours → https://amjaa-travels.web.app
* Amja Travels → https://amjaa-travels-outbound.web.app
* Admin → https://amjaa-travels.web.app/admin/

## First time in the admin

Sign in with your existing admin account (the `admin:true` claim you already set still works). Then:

1. **Company & brand** — check names, phones, address, the two website URLs → **Save**.
2. **Planner rules & pricing** — check the rates, trip options and budget choices → **Save rules**.
3. Open **Hotels, Rent a car, Planner cities, Hajj, Umrah, Flight deals** and press **Load starter data** in each (only shown when a section is empty). Everything is then editable.

Until a section has data, the websites show the same starter content, so nothing ever looks empty.
If a section already has records from the old site, they still display (old field names are mapped); edit them or delete them and load the starter data.

## How the tour planner works

The planner is the Al Musafir expert system, ported to run in the visitor's browser (so no paid Cloud Functions are needed). The pricing maths, city limits, nearest-neighbour routing and validation are the same; the differences are:

* travellers from any country (no GCC-specific content)
* nothing is hard-coded — night options, budget choices, hotel styles and meal plans (set a rate to 0 to hide one), airports (any planner city with an airport code), interests (taken from the cities) all come from the admin
* the planner can offer your hotels: give a hotel the same **City** as a planner city
* driving distance is from the free OSRM road router; if that is unreachable it falls back to an estimate and says so
* the result shows a day-by-day plan, an animated route map, a price breakdown, a PDF, and sends the full plan with the enquiry (admin sees it in **Enquiries**)

## Photos

Paste image links (Unsplash, Google Drive public links, your own hosting, or `images/...` paths that exist in the site folder). Hotels and cars take any number of photos; drag to reorder, the first is the cover.

## Replying to enquiries from the admin (email)

Replies are sent with **EmailJS** (free plan, works without a server):

1. Sign up at emailjs.com → **Email Services** → connect the mailbox you reply from → copy the **Service ID**.
2. **Email Templates** → new template: *To email* `{{to_email}}`, *From name* `{{from_name}}`, *Reply to* `{{reply_to}}`, *Subject* `{{subject}}`, *Content* `{{message}}` → copy the **Template ID**.
3. **Account → API keys** → copy the **Public Key**.
4. Admin → **Inbox → Email replies setup** → paste the three values → Save → *Send test*.

Then open any enquiry → **Reply from here**. The reply is emailed to the customer, saved on the enquiry and the enquiry is marked handled.
The keys are stored in Firestore `private/email`, which only admins can read (deploy the updated `firestore.rules`).

## Our own hotel (Galaxy Grand)

On the Hotels page the client's hotel has its own section at the top with the photo mosaic and the two videos.
In Admin → Hotels tick **"This is OUR hotel"** on that hotel; add video links (.mp4) in **Video links**.
