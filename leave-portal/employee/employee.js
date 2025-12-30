// ===== Page: Employee =====
wireModalClose();

// Tab Navigation
function switchTab(tabName) {
  // Update tabs
  qsa(".nav-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });

  // Update views
  qsa(".section-view").forEach((view) => {
    view.classList.toggle("active", view.id === "view-" + tabName);
  });

  // Save to localStorage
  localStorage.setItem("activeTab", tabName);
}

// Initialize tabs
qsa(".nav-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

// Restore last active tab
const savedTab = localStorage.getItem("activeTab");
if (savedTab) {
  switchTab(savedTab);
}

// init config inputs
const apiBaseInput = qs("#apiBase");
const tokenInput = qs("#token");
apiBaseInput.value = CONFIG.API_BASE;
tokenInput.value = getToken();

qs("#saveBtn").addEventListener("click", () => {
  CONFIG.API_BASE = apiBaseInput.value.trim() || CONFIG.API_BASE;
  setToken(tokenInput.value);
  toast("تم الحفظ", "تم حفظ الـ API Base + Token");
});

qs("#clearBtn").addEventListener("click", () => {
  tokenInput.value = "";
  clearToken();
  toast("تم المسح", "تم مسح التوكن من المتصفح");
});

qs("#refreshBtn").addEventListener("click", () => loadAll());
qs("#loadRequestsBtn").addEventListener("click", () => loadRequests());

qs("#resetBtn").addEventListener("click", () => {
  qs("#startDate").value = "";
  qs("#endDate").value = "";
  qs("#reason").value = "";
  qs("#document").value = "";
  toast("تم", "اتعمل Reset للفورم");
});

// data cache
let eligibleTypes = [];
let allRequests = [];
let currentUser = null;

function computeFYWarning() {
  const s = qs("#startDate").value;
  const e = qs("#endDate").value;
  const warn = qs("#dateWarn");
  warn.style.display = "none";
  if (!s || !e) return;

  const sd = new Date(s + "T00:00:00");
  const ed = new Date(e + "T00:00:00");
  if (ed < sd) return;

  // FY boundary: July 1
  const years = [sd.getFullYear(), ed.getFullYear()];
  for (const y of years) {
    const b = new Date(`${y}-07-01T00:00:00`);
    if (sd < b && ed >= b) {
      warn.style.display = "block";
      return;
    }
  }
}

qs("#startDate").addEventListener("change", computeFYWarning);
qs("#endDate").addEventListener("change", computeFYWarning);

function renderEligibleTypes() {
  const list = qs("#typesList");
  if (!eligibleTypes.length) {
    list.innerHTML = `<div class="muted">لا يوجد أنواع متاحة.</div>`;
    return;
  }
  list.innerHTML = eligibleTypes
    .map(
      (t) => `
    <div class="type-card">
      <div class="type-card-header">
        <div class="name">${escapeHtml(t.type_name)}</div>
      </div>
      <div class="desc">${escapeHtml(t.description || "لا يوجد وصف")}</div>
      <div class="meta">
        <span class="tag"><b>ID:</b> ${t.type_id}</span>
        <span class="tag"><b>الحد الأقصى:</b> ${
          t.max_days_per_request ?? "-"
        } يوم</span>
        <span class="tag"><b>مستند:</b> ${
          t.requires_document ? "مطلوب" : "غير مطلوب"
        }</span>
      </div>
    </div>
  `
    )
    .join("");
}

function renderTypeSelect() {
  const sel = qs("#typeSelect");
  sel.innerHTML = eligibleTypes
    .map(
      (t) => `<option value="${t.type_id}">${escapeHtml(t.type_name)}</option>`
    )
    .join("");
  onTypeChange();
  sel.addEventListener("change", onTypeChange);
}

function onTypeChange() {
  const id = Number(qs("#typeSelect").value);
  const t = eligibleTypes.find((x) => Number(x.type_id) === id);
  const hint = qs("#typeHint");
  const docWrap = qs("#docWrap");

  if (!t) {
    hint.textContent = "";
    docWrap.style.display = "none";
    return;
  }

  hint.textContent = `الحد الأقصى للطلب: ${
    t.max_days_per_request ?? "-"
  } يوم | المستند: ${t.requires_document ? "مطلوب" : "غير مطلوب"}`;
  docWrap.style.display = t.requires_document ? "block" : "none";
}

function renderDashboard(data) {
  const balances = data?.leaveBalances || [];
  const recent = data?.recentRequests || [];

  const pills = qs("#balancesPills");
  pills.innerHTML =
    balances
      .slice(0, 6)
      .map(
        (b) => `
    <div class="balance-pill">
      <div class="type">${escapeHtml(b.type_name)}</div>
      <div class="info">
        <span>الإجمالي: <b>${b.total}</b></span>
        <span>المستخدم: <b>${b.taken}</b></span>
        <span>المتبقي: <b>${b.remaining}</b></span>
      </div>
    </div>
  `
      )
      .join("") || `<div class="muted">لا يوجد أرصدة متاحة.</div>`;

  const body = qs("#recentBody");
  body.innerHTML = recent.length
    ? recent
        .map(
          (r) => `
    <tr>
      <td>${r.request_id}</td>
      <td>${escapeHtml(r.leaveType?.type_name || "-")}</td>
      <td>${fmtDate(r.start_date)}</td>
      <td>${statusBadge(r.status)}</td>
    </tr>
  `
        )
        .join("")
    : `<tr><td colspan="4" class="muted">لا يوجد طلبات حديثة.</td></tr>`;

  // Stats (approved/pending/rejected)
  const norm = (s) => String(s || "").toLowerCase();
  const approved = recent.filter((r) =>
    norm(r.status).includes("approved")
  ).length;
  const pending = recent.filter((r) =>
    norm(r.status).includes("pending")
  ).length;
  const rejected = recent.filter((r) =>
    norm(r.status).includes("rejected")
  ).length;
  const total = recent.length;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const setStat = (id, valId, value) => {
    const el = qs(id);
    const bar = qs(valId);
    if (el) el.textContent = value.toLocaleString("ar-EG");
    if (bar) bar.style.width = Math.min(100, pct(value)) + "%";
  };
  setStat("#statTotal", "#statTotalBar", total);
  setStat("#statApproved", "#statApprovedBar", approved);
  setStat("#statPending", "#statPendingBar", pending);
  setStat("#statRejected", "#statRejectedBar", rejected);

  renderBarChart(recent);
}

function renderBarChart(recent) {
  const cont = qs("#chartBars");
  if (!cont) return;
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: d.getFullYear() + "-" + (d.getMonth() + 1), d });
  }

  const counts = months.map((m) => {
    const c = (recent || []).filter((r) => {
      const sd = r?.start_date ? new Date(r.start_date) : null;
      if (!sd || isNaN(sd.getTime())) return false;
      return sd.getFullYear() + "-" + (sd.getMonth() + 1) === m.key;
    }).length;
    return c;
  });

  const max = Math.max(1, ...counts);
  const names = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];
  cont.innerHTML = months
    .map((m, i) => {
      const h = Math.round((counts[i] / max) * 100);
      const label = names[m.d.getMonth()];
      return `<div class="bar"><div class="hint">${label.slice(
        0,
        3
      )}</div><span style="height:${h}%"></span></div>`;
    })
    .join("");
}

function renderRequestsTable() {
  const body = qs("#requestsBody");
  const q = (qs("#search").value || "").trim().toLowerCase();

  const filtered = !q
    ? allRequests
    : allRequests.filter((r) => {
        const s = `${r.request_id} ${r.status} ${
          r.leaveType?.type_name || ""
        }`.toLowerCase();
        return s.includes(q);
      });

  body.innerHTML = filtered.length
    ? filtered
        .map(
          (r) => `
    <tr>
      <td>${r.request_id}</td>
      <td>${escapeHtml(r.leaveType?.type_name || "-")}</td>
      <td>${statusBadge(r.status)}</td>
      <td><button class="btn" data-view="${
        r.request_id
      }">عرض التفاصيل</button></td>
    </tr>
  `
        )
        .join("")
    : `<tr><td colspan="4" class="muted">لا توجد نتائج.</td></tr>`;

  qsa("button[data-view]", body).forEach((btn) => {
    btn.addEventListener("click", () =>
      showRequestDetails(btn.getAttribute("data-view"))
    );
  });
}

qs("#search").addEventListener("input", renderRequestsTable);

async function showRequestDetails(requestId) {
  try {
    const res = await apiFetch(`/api/me/leave-requests/${requestId}`);
    const d = res?.data;

    const canCancel = String(d?.status || "").toLowerCase() === "pending";

    openModal(`
      <div class="kv" style="font-size: 16px;">
        <div class="k">رقم الطلب</div><div class="v">${escapeHtml(
          d?.request_id
        )}</div>
        <div class="k">الحالة</div><div class="v">${statusBadge(
          d?.status
        )}</div>
        <div class="k">نوع الإجازة</div><div class="v">${escapeHtml(
          d?.leaveType?.type_name || "-"
        )}</div>
        <div class="k">السبب</div><div class="v">${escapeHtml(
          d?.reason || "-"
        )}</div>
      </div>
      <hr class="sep"/>
      <div class="row" style="justify-content:space-between;">
        <div style="font-weight:800; font-size: 18px;">خطوات الموافقة</div>
      </div>
      <div class="table-wrap" style="margin-top:12px;">
        <table>
          <thead>
            <tr>
              <th>الخطوة</th><th>الحالة</th><th>المعتمد</th><th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${
              (d?.approvalSteps?.length ? d.approvalSteps : [])
                .map(
                  (s, idx) => `
              <tr>
                <td>${s.step_order ?? s.step ?? idx + 1}</td>
                <td>${statusBadge(s.status)}</td>
                <td>${escapeHtml(s.approver?.name || "-")}</td>
                <td>${escapeHtml(s.comments || "-")}</td>
              </tr>
            `
                )
                .join("") ||
              `<tr><td colspan="4" class="muted">لا يوجد خطوات.</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <hr class="sep"/>
      <div class="actions">
        ${
          canCancel
            ? `<button class="btn danger" id="cancelBtn" style="font-size: 16px;">إلغاء الطلب</button>`
            : `<span class="muted">لا يمكن الإلغاء إلا إذا الحالة Pending.</span>`
        }
        <button class="btn" onclick="closeModal()" style="font-size: 16px;">إغلاق</button>
      </div>
    `);

    if (canCancel) {
      qs("#cancelBtn").addEventListener("click", async () => {
        try {
          await apiFetch(`/api/me/leave-requests/${requestId}/cancel`, {
            method: "PUT",
          });
          toast("تم", "تم إلغاء الطلب بنجاح");
          closeModal();
          await loadAll();
        } catch (e) {
          toast("خطأ", e.message);
        }
      });
    }
  } catch (e) {
    toast("خطأ", e.message);
  }
}

async function loadDashboard() {
  const res = await apiFetch(`/api/me/dashboard`);
  renderDashboard(res?.data);
}

async function loadProfile() {
  try {
    const res = await apiFetch(`/api/profile`);
    const user = res?.data?.user;
    if (user) {
      currentUser = user;
      const nameEl = qs("#userName");
      const avatarEl = qs("#userAvatar");
      const deptEl = qs("#userDepartment");
      const emailEl = qs("#userEmail");

      if (nameEl) nameEl.textContent = user.name || "موظف";
      if (avatarEl) avatarEl.textContent = (user.name || "؟")[0];
      if (deptEl)
        deptEl.textContent =
          user.department || user.Department?.name || user.role || "—";
      if (emailEl) emailEl.textContent = user.email || "—";

      // Add click handler for user info
      const userInfoEl = qs("#userInfo");
      if (userInfoEl) {
        userInfoEl.style.cursor = "pointer";
        userInfoEl.onclick = showUserProfile;
      }
    }
  } catch (e) {
    console.log("Could not load profile:", e.message);
  }
}

function showUserProfile() {
  if (!currentUser) return;
  const u = currentUser;

  const genderText =
    u.gender === "Male"
      ? "ذكر"
      : u.gender === "Female"
      ? "أنثى"
      : u.gender || "—";
  const userTypeText =
    u.user_type === "Academic"
      ? "أكاديمي"
      : u.user_type === "Administrative"
      ? "إداري"
      : u.user_type || "—";

  openModal(`
    <div class="modal-header">
      <div class="modal-title">
        <span class="modal-icon">👤</span>
        <div>
          <h2>الملف الشخصي</h2>
          <span class="modal-subtitle">تفاصيل الموظف</span>
        </div>
      </div>
      <button class="modal-close-btn" onclick="closeModal()">
        <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="modal-body">
      <div class="profile-header">
        <div class="profile-avatar">${escapeHtml((u.name || "؟")[0])}</div>
        <div class="profile-name">${escapeHtml(u.name || "—")}</div>
        <div class="profile-role">${escapeHtml(u.role || "—")}</div>
      </div>
      
      <div class="profile-grid">
        <div class="profile-item">
          <div class="profile-label">📧 البريد الإلكتروني</div>
          <div class="profile-value">${escapeHtml(u.email || "—")}</div>
        </div>
        <div class="profile-item">
          <div class="profile-label">📞 رقم الهاتف</div>
          <div class="profile-value">${escapeHtml(u.phone || "—")}</div>
        </div>
        <div class="profile-item">
          <div class="profile-label">🏢 نوع الموظف</div>
          <div class="profile-value">${escapeHtml(userTypeText)}</div>
        </div>
        <div class="profile-item">
          <div class="profile-label">👥 الجنس</div>
          <div class="profile-value">${escapeHtml(genderText)}</div>
        </div>
        <div class="profile-item">
          <div class="profile-label">📅 تاريخ التعيين</div>
          <div class="profile-value">${fmtDate(u.hire_date)}</div>
        </div>
        <div class="profile-item">
          <div class="profile-label">🎂 تاريخ الميلاد</div>
          <div class="profile-value">${fmtDate(u.date_of_birth)}</div>
        </div>
        <div class="profile-item">
          <div class="profile-label">🆔 رقم الموظف</div>
          <div class="profile-value">${escapeHtml(u.user_id || "—")}</div>
        </div>
        <div class="profile-item">
          <div class="profile-label">📍 الحالة</div>
          <div class="profile-value">${
            u.is_active
              ? '<span style="color: var(--chip-1)">✔ نشط</span>'
              : '<span style="color: var(--bad)">✖ غير نشط</span>'
          }</div>
        </div>
      </div>
    </div>
  `);
}

async function loadEligibleTypes() {
  const res = await apiFetch(`/api/me/eligible-leave-types`);
  eligibleTypes = Array.isArray(res?.data) ? res.data : [];
  renderEligibleTypes();
  renderTypeSelect();
}

async function loadRequests() {
  const res = await apiFetch(`/api/me/leave-requests`);
  allRequests = Array.isArray(res?.data) ? res.data : [];
  renderRequestsTable();
  // Update requests count badge
  const countBadge = qs("#requestsCount");
  if (countBadge) {
    countBadge.textContent = allRequests.length;
  }
}

async function loadAll() {
  try {
    toast("تحميل", "جاري جلب بيانات الموظف...");
    await Promise.all([
      loadProfile(),
      loadDashboard(),
      loadEligibleTypes(),
      loadRequests(),
    ]);
    toast("تمام", "اتحدثت البيانات بنجاح");
  } catch (e) {
    toast("خطأ", e.message);
  }
}

qs("#submitBtn").addEventListener("click", async () => {
  try {
    const type_id = Number(qs("#typeSelect").value);
    const start_date = qs("#startDate").value;
    const end_date = qs("#endDate").value;
    const reason = qs("#reason").value.trim();
    const file = qs("#document").files?.[0] || null;

    if (!type_id || !start_date || !end_date || !reason) {
      toast("ناقص بيانات", "من فضلك املأ النوع + التواريخ + السبب");
      return;
    }
    const sd = new Date(start_date + "T00:00:00");
    const ed = new Date(end_date + "T00:00:00");
    if (ed < sd) {
      toast("تواريخ غير صحيحة", "End Date لازم يكون بعد Start Date");
      return;
    }

    const t = eligibleTypes.find((x) => Number(x.type_id) === type_id);
    if (t?.requires_document && !file) {
      toast("مستند مطلوب", "النوع المختار يتطلب رفع ملف");
      return;
    }

    // Always send as form-data (API expects form-data)
    const fd = new FormData();
    fd.append("type_id", String(type_id));
    fd.append("start_date", start_date);
    fd.append("end_date", end_date);
    fd.append("reason", reason);
    if (file) fd.append("document", file);

    await apiFetch(`/api/me/leave-requests`, {
      method: "POST",
      body: fd,
      isForm: true,
    });

    toast("تم الإرسال", "تم إنشاء الطلب بنجاح");
    qs("#reason").value = "";
    qs("#document").value = "";
    await loadAll();

    // Switch to history tab after successful submission
    switchTab("history");
  } catch (e) {
    toast("خطأ", e.message);
  }
});
document.addEventListener('DOMContentLoaded', function() {
    
    // Select elements
    const notifBtn = document.querySelector('button[title="الاشعارات"]');
    const badge = notifBtn.querySelector('.badge-count');
    const dropdown = document.getElementById('notificationDropdown');
    const notifList = document.getElementById('notifList');
    const emptyState = document.getElementById('emptyState');
    const markAllBtn = document.getElementById('markAllBtn');

    // 1. Open/Close Menu
    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !notifBtn.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    // 2. Count Logic
    function updateBadge() {
        const count = notifList.children.length;
        if (count > 0) {
            badge.style.display = 'flex';
            badge.innerText = count;
            emptyState.style.display = 'none';
        } else {
            badge.style.display = 'none'; // Hide red dot if 0
            emptyState.style.display = 'block'; // Show empty state
        }
    }

    // 3. Remove Single Item (Click X)
    notifList.addEventListener('click', function(e) {
        const btn = e.target.closest('.mark-read-btn');
        if (!btn) return;

        const item = btn.closest('.notif-item');
        item.style.animation = 'slideOut 0.3s forwards';
        
        setTimeout(() => {
            item.remove();
            updateBadge();
        }, 300);
    });

    // 4. Remove All Items
    markAllBtn.addEventListener('click', function() {
        const items = notifList.querySelectorAll('.notif-item');
        items.forEach((item, index) => {
            setTimeout(() => {
                item.style.animation = 'slideOut 0.3s forwards';
            }, index * 50);
        });

        setTimeout(() => {
            notifList.innerHTML = '';
            updateBadge();
        }, 300 + (items.length * 50));
    });

    // Initial check
    updateBadge();
});
// auto-load
loadAll();
