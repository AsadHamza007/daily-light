/* Daily Light — native prayer alarms (Android, via Capacitor) + web download banner.
 *
 * On the web / PWA this file does almost nothing (the browser cannot ring an alarm
 * when the app is closed). Inside the native Android app it uses the OS scheduler
 * (Capacitor Local Notifications, backed by AlarmManager) to fire a real alarm at
 * every prayer time — even when the app is closed or the phone is locked.
 *
 * It reads the SAME prayer times the app already shows (window.DL_getPrayerSchedule),
 * so the alarm matches the on-screen timetable exactly, and reschedules on every
 * open / resume and whenever the user changes location, method, Asr or the toggle.
 */
(function () {
  'use strict';

  /* After you publish the Android app, paste its Play Store (or APK) link here and
     push — web/PWA users will then see a small "get the app for prayer alarms"
     banner. Leave empty to show nothing. */
  window.DL_APP_URL = window.DL_APP_URL || '';

  var C = window.Capacitor;
  var isNative = !!(C && C.isNativePlatform && C.isNativePlatform());

  if (!isNative) { showWebBanner(); return; }

  var LN = C.Plugins && C.Plugins.LocalNotifications;
  var App = C.Plugins && C.Plugins.App;
  if (!LN) return;

  var IDS_KEY = 'dl.native.alarmIds';
  var CH = 'prayer-alarm-v1';   // bump this suffix if you change the sound/importance later
  var busy = false;

  function saveIds(ids) { try { localStorage.setItem(IDS_KEY, JSON.stringify(ids)); } catch (e) {} }
  function loadIds() { try { return JSON.parse(localStorage.getItem(IDS_KEY) || '[]') || []; } catch (e) { return []; } }

  function order(id) { return ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].indexOf(id); }
  function idFor(item) {
    var dayNo = Math.floor(item.ts / 86400000) % 100000;
    return 720000 + dayNo * 10 + Math.max(0, order(item.id));
  }
  function fmt(ts) {
    try { return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
    catch (e) { var d = new Date(ts); return d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2); }
  }

  async function ensureChannel(sound) {
    try {
      await LN.createChannel({
        id: CH, name: 'Namaz alarm', description: 'Prayer time alarm',
        importance: 5, visibility: 1, vibration: true, lights: true,
        sound: sound ? 'azaan' : undefined      // android/app/src/main/res/raw/azaan.(wav|mp3)
      });
    } catch (e) {}
  }

  async function reschedule() {
    if (busy) return; busy = true;
    try {
      var perm = await LN.checkPermissions().catch(function () { return { display: 'prompt' }; });
      if (perm.display !== 'granted') {
        var r = await LN.requestPermissions().catch(function () { return { display: 'denied' }; });
        if (r.display !== 'granted') return;
      }

      // clear the alarms we scheduled last time
      var old = loadIds();
      if (old.length) {
        try { await LN.cancel({ notifications: old.map(function (id) { return { id: id }; }) }); } catch (e) {}
      }

      var sched = window.DL_getPrayerSchedule ? window.DL_getPrayerSchedule(3) : null;
      if (!sched || !sched.enabled || !sched.items || !sched.items.length) { saveIds([]); return; }

      await ensureChannel(sched.sound);

      var notifs = [], ids = [], seen = {};
      sched.items.forEach(function (it) {
        var id = idFor(it); if (seen[id]) return; seen[id] = 1;
        notifs.push({
          id: id,
          title: it.name + ' ka waqt ho gaya',
          body: fmt(it.ts) + ' \u00B7 Daily Light',
          channelId: CH,
          smallIcon: 'ic_stat_icon',
          sound: sched.sound ? 'azaan' : undefined,
          schedule: { at: new Date(it.ts), allowWhileIdle: true },
          extra: { dl: true, prayer: it.id }
        });
        ids.push(id);
      });

      try { await LN.schedule({ notifications: notifs }); saveIds(ids); }
      catch (e) { saveIds([]); }
    } finally { busy = false; }
  }

  function boot() {
    reschedule();
    if (App && App.addListener) App.addListener('resume', reschedule);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) reschedule(); });
    try { LN.addListener('localNotificationReceived', function () { setTimeout(reschedule, 4000); }); } catch (e) {}
    setInterval(reschedule, 6 * 60 * 60 * 1000);   // daily safety net
  }

  // debounced hook the app calls from save() on any settings change
  var t = null;
  window.DL_syncNativeAlarms = function () { clearTimeout(t); t = setTimeout(reschedule, 1500); };

  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 800);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 800); });

  /* ---------------- web-only "get the app" banner ---------------- */
  function showWebBanner() {
    if (!window.DL_APP_URL) return;
    try { if (localStorage.getItem('dl.appbanner.dismissed') === '1') return; } catch (e) {}
    function build() {
      if (document.getElementById('dlAppBanner') || !document.body) return;
      var b = document.createElement('div'); b.id = 'dlAppBanner';
      b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:14px;background:#0b1330;border:1px solid rgba(216,182,108,.5);box-shadow:0 10px 30px rgba(0,0,0,.4);font-family:system-ui,-apple-system,sans-serif';
      b.innerHTML =
        '<span style="color:#e9edf7;font-size:13px;line-height:1.45">Namaz ka <b>proper alarm</b> \u2014 app band ho tab bhi bajega. App download karein.</span>' +
        '<span style="display:flex;gap:8px;flex-shrink:0;align-items:center">' +
          '<a href="' + window.DL_APP_URL + '" target="_blank" rel="noopener" style="background:#d8b66c;color:#1a1204;font-weight:700;font-size:13px;padding:9px 14px;border-radius:10px;text-decoration:none;white-space:nowrap">Download</a>' +
          '<button id="dlAppX" aria-label="Close" style="background:transparent;border:0;color:#8b93a7;font-size:22px;line-height:1;cursor:pointer;padding:0 4px">\u00D7</button>' +
        '</span>';
      document.body.appendChild(b);
      document.getElementById('dlAppX').onclick = function () {
        b.remove(); try { localStorage.setItem('dl.appbanner.dismissed', '1'); } catch (e) {}
      };
    }
    if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
  }
})();
