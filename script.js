/* ── CLOCK ── */
const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];
function tick() {
  const n = new Date();
  const hms = [n.getHours(), n.getMinutes(), n.getSeconds()]
    .map((x) => String(x).padStart(2, "0"))
    .join(":");
  document.getElementById("clockTime").textContent = hms;
  document.getElementById("clockDate").textContent = `${
    DAYS[n.getDay()]
  }, ${n.getDate()} ${MONS[n.getMonth()]} ${n.getFullYear()}`;
}
tick();
setInterval(tick, 1000);

/* ── COUNT ANIMATION ── */
function animCount(el, to, dur = 650) {
  const s = performance.now(),
    from = parseInt(el.textContent) || 0;
  (function step(now) {
    const p = Math.min((now - s) / dur, 1),
      e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  })(s);
}

/* ── PARSER ── */
let allRows = [];

function normStatus(raw) {
  let r = raw
    .toLowerCase()
    .replace(/\bizim\b/g, "izin")
    .replace(/\s+/g, " ")
    .trim();

  /* =========================
     HADIR / SUDAH MASUK
  ========================= */

  // izin pulang cepat => tetap hadir
  if (/izin.*pulang cepat|pulang cepat/.test(r)) {
    return "IZIN_PULANG_CEPAT";
  }

  // hadir normal
  if (/\b(sudah masuk|sudah hadir|sudah datang)\b/.test(r)) {
    // izin datang siang
    if (/izin.*siang/.test(r)) {
      return "IZIN_SIANG";
    }

    // terlambat tapi masuk
    if (/terlambat/.test(r)) {
      return "IZIN_TERLAMBAT";
    }

    return "MASUK";
  }

  /* =========================
     TIDAK HADIR
  ========================= */

  if (/\balfa\b/.test(r)) {
    return "ALFA";
  }

  if (/\bsakit\b/.test(r)) {
    return "SAKIT";
  }

  if (/\bcuti\b/.test(r)) {
    return "CUTI";
  }

  /* =========================
     IZIN KHUSUS
  ========================= */

  // izin masuk siang
  if (/izin.*siang/.test(r)) {
    return "IZIN_SIANG";
  }

  // izin terlambat
  if (/izin.*terlambat|terlambat/.test(r)) {
    return "IZIN_TERLAMBAT";
  }

  // izin tidak masuk / izin biasa
  if (/\bizin\b/.test(r) || /tidak masuk/.test(r)) {
    return "IZIN_TIDAK_MASUK";
  }

  return "LAIN";
}
function counted(s) {
  return ["SAKIT", "ALFA", "CUTI", "IZIN_TIDAK_MASUK"].includes(s);
}

function parse(text) {
  const rows = [];

  // Normalize line ending
  text = text.replace(/\r/g, "");

  // Split lines
  const lines = text.split("\n");

  let buffer = [];

  function processBuffer(raw) {
    if (!raw) return;

    // Bersihkan numbering depan
    raw = raw
      .replace(/^\s*\d+\.\s*/, "")
      .replace(/\s+/g, " ")
      .trim();

    // Cari status dalam tanda kurung terakhir
    const match = raw.match(/\((.*?)\)\s*$/i);

    if (!match) return;

    const sRaw = match[1].trim();

    // Ambil bagian sebelum (...)
    let before = raw.slice(0, match.index).trim();

    // Pisahkan nama & departemen
    let name = "";
    let dept = "";

    const commaIndex = before.indexOf(",");

    if (commaIndex !== -1) {
      name = before.slice(0, commaIndex).trim();
      dept = before.slice(commaIndex + 1).trim();
    } else {
      name = before.trim();
    }

    // Validasi minimal
    if (!name) return;

    const status = normStatus(sRaw);

    // Skip yang hadir normal
    if (status === "MASUK") return;

    rows.push({
      name,
      dept,
      sRaw,
      status,
    });
  }

  for (let line of lines) {
    let t = line.trim();

    // Skip kosong
    if (!t) {
      if (buffer.length) {
        processBuffer(buffer.join(" "));
        buffer = [];
      }
      continue;
    }

    // Skip header *
    if (/^\*.*\*$/.test(t)) {
      if (buffer.length) {
        processBuffer(buffer.join(" "));
        buffer = [];
      }
      continue;
    }

    // Jika line baru numbering
    if (/^\s*\d+\./.test(t)) {
      if (buffer.length) {
        processBuffer(buffer.join(" "));
      }
      buffer = [t];
    } else {
      // Lanjutan multiline
      if (buffer.length) {
        buffer.push(t);
      }
    }
  }

  // Process terakhir
  if (buffer.length) {
    processBuffer(buffer.join(" "));
  }

  return rows;
}

/* ── BADGE ── */
function badge(status, raw) {
  const m = {
    SAKIT: ["bdg-sakit", "bi-thermometer-half", "SAKIT"],
    ALFA: ["bdg-alfa", "bi-x-circle", "ALFA"],
    CUTI: ["bdg-cuti", "bi-calendar-check", "CUTI"],
    IZIN_SIANG: ["bdg-izin", "bi-clock", "IZIN MASUK SIANG"],
    IZIN_TERLAMBAT: ["bdg-other", "bi-clock-history", "IZIN TERLAMBAT"],
    IZIN_TIDAK_MASUK: ["bdg-other", "bi-person-x", "IZIN TIDAK MASUK"],
    IZIN_PULANG_CEPAT: ["bdg-other", "bi-box-arrow-right", "IZIN PULANG CEPAT"],
    IZIN_LAIN: ["bdg-other", "bi-info-circle", "IZIN"],
    LAIN: ["bdg-other", "bi-question-circle", raw.toUpperCase()],
  };
  const [cls, ico, lbl] = m[status] || m.LAIN;
  return `<span class="bdg ${cls}"><i class="bi ${ico}"></i>${lbl}</span>`;
}

/* ── RENDER ── */
function renderSummary(rows) {
  const cnt = rows.filter((r) => counted(r.status));
  const dm = {};
  cnt.forEach((r) => {
    const d = r.dept || "Lainnya";
    dm[d] = (dm[d] || 0) + 1;
  });
  animCount(document.getElementById("statAbsen"), cnt.length);
  animCount(document.getElementById("statBagian"), Object.keys(dm).length);
  animCount(document.getElementById("statTotal"), rows.length);
  const g = document.getElementById("deptGrid");
  if (!Object.keys(dm).length) {
    g.innerHTML = `<div class="empty-ph w-100"><i class="bi bi-bar-chart-line"></i><p>Belum ada data.<br/>Klik PROSES DATA untuk memulai analisis.</p></div>`;
    return;
  }
  g.innerHTML = Object.entries(dm)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([d, n], i) =>
        `<div class="dept-card" style="animation-delay:${i * 45}ms">
  <div class="dept-name">${d}</div>
  <div class="dept-num">${n}</div>
  <div class="dept-lbl">Tidak Hadir</div>
</div>`
    )
    .join("");
}

function searchLabel(status, raw) {
  const labels = {
    SAKIT: "sakit",
    ALFA: "alfa",
    CUTI: "cuti",
    IZIN_SIANG: "izin masuk siang",
    IZIN_TERLAMBAT: "izin terlambat",
    IZIN_LAIN: "izin",
    IZIN_TIDAK_MASUK: "izin tidak masuk",
    LAIN: raw,
  };

  return (labels[status] || raw).toLowerCase();
}

function renderTable(rows, q = "") {
  const body = document.getElementById("tblBody");
  const f = q
    ? rows.filter((r) => {
        const keyword = q.toLowerCase();

        return (
          r.name.toLowerCase().includes(keyword) ||
          r.dept.toLowerCase().includes(keyword) ||
          r.status.toLowerCase().includes(keyword) ||
          r.sRaw.toLowerCase().includes(keyword) ||
          searchLabel(r.status, r.sRaw).includes(keyword)
        );
      })
    : rows;
  if (!f.length) {
    body.innerHTML = `<tr><td colspan="4"><div class="empty-ph">
  <i class="bi bi-person-x"></i>
  <p>${
    rows.length
      ? "Tidak ada hasil pencarian."
      : "Proses text absensi untuk melihat data detail."
  }</p>
</div></td></tr>`;
    return;
  }
  body.innerHTML = f
    .map(
      (r, i) => `
<tr class="row-fade" style="animation-delay:${i * 28}ms">
  <td><span class="row-num">${i + 1}</span></td>
  <td><div class="emp-name">${r.name}</div></td>
  <td><div class="emp-dept">${
    r.dept || '<span style="color:var(--txt3)">—</span>'
  }</div></td>
  <td><div class="td-badge">
    ${badge(r.status, r.sRaw)}
    ${!counted(r.status) ? '<span class="not-counted-tag"></span>' : ""}
  </div></td>
</tr>`
    )
    .join("");
}

/* ── ACTIONS ── */
function prosesData() {
  const btn = document.getElementById("btnProses");
  btn.innerHTML = '<i class="bi bi-arrow-repeat spin me-2"></i>MEMPROSES…';
  btn.style.opacity = ".8";
  setTimeout(() => {
    allRows = parse(document.getElementById("inputText").value);
    renderSummary(allRows);
    renderTable(allRows);
    btn.innerHTML =
      '<i class="bi bi-lightning-charge-fill me-2"></i>PROSES DATA';
    btn.style.opacity = "";
  }, 250);
}
function bersihkan() {
  document.getElementById("inputText").value = "";
  document.getElementById("searchBox").value = "";
  allRows = [];
  ["statAbsen", "statBagian", "statTotal"].forEach((id) =>
    animCount(document.getElementById(id), 0, 300)
  );
  renderSummary([]);
  renderTable([]);
}
function filterTable() {
  renderTable(allRows, document.getElementById("searchBox").value);
}

function exportExcel() {
  if (!allRows.length) {
    alert("Tidak ada data untuk diekspor.");
    return;
  }
  const data = allRows.map((r, i) => ({
    No: i + 1,
    Nama: r.name,
    Bagian: r.dept,
    Keterangan: r.sRaw,
    Dihitung: counted(r.status) ? "Ya" : "Tidak",
  }));
  try {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absensi");
    const d = new Date();
    XLSX.writeFile(
      wb,
      `absensi_${d.getFullYear()}${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}${String(d.getDate()).padStart(2, "0")}.xlsx`
    );
  } catch (e) {
    const csv = [
      "No,Nama,Bagian,Keterangan,Dihitung",
      ...data.map(
        (r) =>
          `${r.No},"${r.Nama}","${r.Bagian}","${r.Keterangan}","${r.Dihitung}"`
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "absensi.csv";
    a.click();
  }
}

window.addEventListener("DOMContentLoaded", prosesData);
