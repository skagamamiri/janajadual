/* ============================================================
   ICT HUB — Header Bersama Untuk Semua Tool
   ------------------------------------------------------------
   Cara guna dalam mana-mana tool (letak dalam <head>):

     <script src="ict-header.js"></script>

   Kemudian letak elemen ini di bahagian paling atas <body>:

     <ict-header
       icon="fa-solid fa-calendar-days"
       title="Nama Tool"
       subtitle="Penerangan ringkas tool.">
     </ict-header>

   - icon     : kelas ikon Font Awesome 6 (font dimuatkan automatik)
   - title    : tajuk tool
   - subtitle : penerangan ringkas (pilihan)
   - back     : URL butang kembali (pilihan, lalai "./" iaitu ICT HUB)

   Nama guru dipaparkan automatik daripada sesi log masuk ICT HUB.
   Tool boleh menetapkan nama/peranan sendiri dengan:
     ICTHeader.setUser("Nama Guru", "ADMIN");
   atau dengan menukar teks elemen #userName dan #userRole.

   Header ini sengaja TIDAK mempunyai butang log keluar.
   ============================================================ */
(function () {
  "use strict";

  var FA_HREF = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
  var EYEBROW = "Hub Tool ICT • SK Agama (MIS) Miri";

  function ensureFontAwesome() {
    var has = Array.prototype.some.call(document.querySelectorAll('link[rel="stylesheet"]'), function (l) {
      return /font-?awesome/i.test(l.href || "");
    });
    if (has) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FA_HREF;
    (document.head || document.documentElement).appendChild(link);
  }

  function ensureStyles() {
    if (document.getElementById("ict-header-style")) return;
    var css = [
      "ict-header{display:block;position:relative;z-index:30}",
      ".ict-hdr{background:linear-gradient(135deg,#052b20,#009b62 65%,#087da2);color:#fff;",
      "padding:22px max(20px,calc((100vw - 1180px)/2));",
      "font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;",
      "box-sizing:border-box;width:100%}",
      ".ict-hdr *{box-sizing:border-box}",
      ".ict-hdr-inner{display:flex;align-items:center;justify-content:space-between;gap:16px}",
      ".ict-hdr-brand{display:flex;align-items:center;gap:12px;min-width:0}",
      ".ict-hdr-back{width:40px;height:40px;border-radius:12px;border:1px solid #ffffff35;background:#ffffff14;",
      "color:#fff;font-size:17px;display:grid;place-items:center;flex:0 0 auto;cursor:pointer;text-decoration:none;",
      "transition:background .15s ease}",
      ".ict-hdr-back:hover{background:#ffffff26}",
      ".ict-hdr-icon{width:52px;height:52px;border-radius:16px;background:#fff;color:#009b62;display:grid;",
      "place-items:center;font-size:22px;box-shadow:0 8px 24px #0002;flex:0 0 auto}",
      ".ict-hdr-text{min-width:0}",
      ".ict-hdr-eyebrow{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.78;",
      "margin:0;line-height:1.4}",
      ".ict-hdr-title{margin:4px 0;font-size:clamp(21px,4vw,30px);font-weight:800;line-height:1.15;color:#fff;",
      "letter-spacing:normal;text-transform:none}",
      ".ict-hdr-sub{margin:0;color:#d8f6ea;font-size:13px;line-height:1.45}",
      ".ict-hdr-user{text-align:right;flex:0 0 auto;max-width:40%}",
      ".ict-hdr-user strong{display:block;font-size:14px;font-weight:800;color:#fff;white-space:nowrap;",
      "overflow:hidden;text-overflow:ellipsis}",
      ".ict-hdr-user small{display:block;font-size:10px;font-weight:800;opacity:.8;letter-spacing:.04em}",
      ".ict-hdr-user.is-empty{display:none}",
      "@media(max-width:850px){.ict-hdr{padding:18px 16px}.ict-hdr-inner{align-items:flex-start}.ict-hdr-user{display:none}}",
      "@media(max-width:520px){.ict-hdr-icon{display:none}.ict-hdr-sub{font-size:11.5px}}",
      "@media print{ict-header{display:none!important}}"
    ].join("");
    var style = document.createElement("style");
    style.id = "ict-header-style";
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c];
    });
  }

  function goBack(fallback) {
    var sameOriginReferrer = false;
    try {
      sameOriginReferrer = !!document.referrer && new URL(document.referrer).origin === location.origin;
    } catch (e) {}
    if (sameOriginReferrer && history.length > 1) history.back();
    else location.href = fallback || "./";
  }

  function refreshUserBox() {
    var name = document.getElementById("userName");
    var box = document.querySelector(".ict-hdr-user");
    if (!name || !box) return;
    var t = (name.textContent || "").trim();
    box.classList.toggle("is-empty", !t || t === "-");
  }

  // Baca nama pengguna daripada sesi Firebase (berfungsi untuk semua versi SDK).
  function readFirebaseUser(cb) {
    try {
      var req = indexedDB.open("firebaseLocalStorageDb");
      req.onerror = function () { cb(null); };
      req.onsuccess = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains("firebaseLocalStorage")) { db.close(); return cb(null); }
        var all = db.transaction("firebaseLocalStorage", "readonly").objectStore("firebaseLocalStorage").getAll();
        all.onsuccess = function () {
          var hit = (all.result || []).find(function (r) {
            return r && /^firebase:authUser:.*:\[DEFAULT\]$/.test(r.fbase_key || "");
          });
          db.close();
          cb(hit && hit.value ? hit.value : null);
        };
        all.onerror = function () { db.close(); cb(null); };
      };
    } catch (e) { cb(null); }
  }

  class IctHeader extends HTMLElement {
    connectedCallback() {
      if (this._rendered) return;
      this._rendered = true;
      ensureStyles();
      ensureFontAwesome();

      var icon = this.getAttribute("icon") || "fa-solid fa-toolbox";
      var title = this.getAttribute("title") || document.title || "Tool ICT";
      var sub = this.getAttribute("subtitle") || "";
      var back = this.getAttribute("back") || "./";
      // Elak tooltip "title" pada keseluruhan header.
      this.removeAttribute("title");

      this.innerHTML =
        '<header class="ict-hdr">' +
          '<div class="ict-hdr-inner">' +
            '<div class="ict-hdr-brand">' +
              '<a class="ict-hdr-back" href="' + esc(back) + '" title="Kembali ke ICT HUB" aria-label="Kembali ke ICT HUB">' +
                '<i class="fa-solid fa-arrow-left"></i></a>' +
              '<div class="ict-hdr-icon"><i class="' + esc(icon) + '"></i></div>' +
              '<div class="ict-hdr-text">' +
                '<p class="ict-hdr-eyebrow">' + esc(EYEBROW) + '</p>' +
                '<h1 class="ict-hdr-title">' + esc(title) + '</h1>' +
                (sub ? '<p class="ict-hdr-sub">' + esc(sub) + '</p>' : '') +
              '</div>' +
            '</div>' +
            '<div class="ict-hdr-user is-empty">' +
              '<strong id="userName"></strong>' +
              '<small id="userRole"></small>' +
            '</div>' +
          '</div>' +
        '</header>';

      var backEl = this.querySelector(".ict-hdr-back");
      backEl.addEventListener("click", function (e) { e.preventDefault(); goBack(back); });

      // Pantau perubahan nama yang dibuat oleh tool sendiri.
      var nameEl = this.querySelector("#userName");
      new MutationObserver(refreshUserBox).observe(nameEl, { childList: true, characterData: true, subtree: true });

      // Isi nama daripada sesi ICT HUB jika tool belum menetapkannya.
      readFirebaseUser(function (u) {
        if (!u || (nameEl.textContent || "").trim()) return;
        nameEl.textContent = u.displayName || u.email || "";
        var role = document.getElementById("userRole");
        if (role && !role.textContent.trim()) role.textContent = "GURU";
      });
    }
  }

  if (!customElements.get("ict-header")) customElements.define("ict-header", IctHeader);

  window.ICTHeader = {
    setUser: function (name, role) {
      var n = document.getElementById("userName");
      var r = document.getElementById("userRole");
      if (n) n.textContent = name || "";
      if (r) r.textContent = role || "";
      refreshUserBox();
    },
    clearUser: function () { this.setUser("", ""); }
  };
})();
