# Daily Light — Native Android app (real prayer alarms)

This wraps the existing Daily Light web app in a native Android shell and adds
**real OS alarms** for the five prayers. Unlike the website, these fire even when
the app is **closed or the phone is locked**, offline, with sound + vibration.

The web app is untouched and keeps working as before. This folder only adds the
native layer on top of it.

---

## How it works

- The web app already computes prayer times offline (the `adhan` library) and now
  exposes them via `window.DL_getPrayerSchedule(days)` (in `index.html`).
- `native-alarm.js` (in the repo root) detects when it is running inside the native
  app and schedules one OS alarm per prayer via **Capacitor Local Notifications**
  (backed by Android `AlarmManager`).
- It reschedules automatically on every open/resume and whenever the user changes
  location, calculation method, Asr, sound, or the alarm toggle — so the alarm
  always matches the on-screen timetable.

---

## Prerequisites (on the machine that builds the app)

- Node.js 18+ and npm
- Android Studio (latest) with the Android SDK + a JDK (17)
- A Google Play Console account (to publish)

## Build steps

From this `native/` folder:

```bash
npm install
npm run copy:web          # copies the web app into native/www
npx cap add android       # generates the android/ project (first time only)
npx cap sync android      # copies web assets + plugins into the android project
```

Then finish the **one-time Android setup** below, and open the project:

```bash
npx cap open android      # opens android/ in Android Studio → Run / Build
```

Whenever you update the web app later, just re-run:

```bash
npm run copy:web && npx cap sync android
```

---

## One-time Android setup (after `npx cap add android`)

### 1) Azaan / alarm sound
Put your sound file here (lowercase name, no spaces), e.g.:

```
android/app/src/main/res/raw/azaan.wav      (or azaan.mp3)
```

The code references it as `sound: 'azaan'`. If you rename it, update `native-alarm.js`.

> Tip: keep it a proper alarm-length clip. If you change the sound later, also bump
> the channel id in `native-alarm.js` (`CH = 'prayer-alarm-v1'` → `-v2`), because
> Android caches a channel's sound after first creation.

### 2) Permissions — `android/app/src/main/AndroidManifest.xml`
Add inside `<manifest>` (some may already be added by the plugin — duplicates are fine to remove):

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.USE_EXACT_ALARM" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.VIBRATE" />
```

`USE_EXACT_ALARM` is the right choice for an alarm/prayer app (auto-granted, and
Google Play permits it for genuine alarm use-cases). It lets alarms fire at the
exact minute even in Doze/battery-saver.

### 3) Small status-bar icon (optional but recommended)
Add a white, transparent silhouette icon named `ic_stat_icon` via
Android Studio → `res` → New → Image Asset → **Notification Icon**. Without it the
app icon is used, which can look wrong in the status bar.

### 4) App icon
Replace the launcher icon via Android Studio → New → Image Asset → **Launcher
Icons**, using `icon-512.png` from the repo root.

---

## Publish

1. In Android Studio: **Build → Generate Signed App Bundle** (create/keep a keystore — back it up safely).
2. Upload the `.aab` to Google Play Console, fill the store listing, and roll out.
3. After it's live, open the repo root `native-alarm.js` and set:

   ```js
   window.DL_APP_URL = 'https://play.google.com/store/apps/details?id=com.codelps.dailylight';
   ```

   Commit + push. Now everyone using the **web/PWA** version sees a small
   "download the app for prayer alarms" banner, so existing users can move over.

> Note: people who added the old website to their home screen will **not** get
> real closed-app alarms until they install this native app once — that's a web
> platform limit, not a bug.

---

## Test checklist

- Set a city/location, turn the alarm **On**.
- Set a prayer time 2 minutes ahead (change device clock or wait for the next prayer),
  fully close the app, lock the phone → the alarm should fire with sound + vibration.
- Reboot the phone, wait for the next prayer → it should still fire (boot reschedule).
- Toggle the alarm Off → no alarms fire.

---

## Optional upgrade: full-screen "ringing" alarm (advanced)

The setup above fires a heads-up notification with your azaan sound and vibration —
this already solves "nothing happens when the app is closed."

If you want a true alarm-clock experience — a **full-screen screen that rings until
dismissed**, over the lock screen, playing the whole azaan on the alarm audio
stream — that needs a small custom native module (not just the JS plugin):

- Schedule with `AlarmManager.setAlarmClock(...)` (most reliable, shows the alarm icon).
- A `BroadcastReceiver` receives it and starts a **foreground Service** that plays
  the azaan via `MediaPlayer` on `AudioManager.STREAM_ALARM`.
- Post a notification with `setFullScreenIntent(...)` + a full-screen `Activity`
  (with `setShowWhenLocked(true)` / `setTurnScreenOn(true)`) showing the prayer name
  and a **Stop** button.
- A `RECEIVE_BOOT_COMPLETED` receiver reschedules after reboot.

This is straightforward for an Android developer but should be built and tested
per device before release (OEM battery managers vary). Ship the base version first;
add this as a v2 if you want the louder experience.
