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
  const today = new Date(); // لتحديد تاريخ اليوم

  // 1. عرض الأرصدة (كما هي)
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

  // 2. عرض جدول "آخر الطلبات" (مع زر العودة الجديد)
  const body = qs("#recentBody");
  
  // ضبط تاريخ اليوم (بدون ساعات) للمقارنة الصحيحة
  const todayDateOnly = new Date();
  todayDateOnly.setHours(0,0,0,0);

  body.innerHTML = recent.length
    ? recent
        .map((r) => {
            // --- منطق زر العودة ---
            const endDate = new Date(r.end_date);
            
            // هل الحالة Approved + التاريخ انتهى + لم يسجل عودة بعد؟
            const isApproved = r.status === 'Approved';
            const isFinished = todayDateOnly > endDate;
            const notReturned = !r.returned_at;

            let actionOrStatus = statusBadge(r.status); // الافتراضي: عرض الحالة فقط

            // لو الشروط تحققت، اعرض الزر بجانب الحالة أو بدلاً منها
            if (isApproved && isFinished && notReturned) {
                actionOrStatus = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${statusBadge(r.status)}
                        <button class="btn" 
                                style="background-color: #014964; color: white; border:none; padding: 4px 10px; font-size: 12px;" 
                                onclick="submitReturnDeclaration(${r.request_id})">
                            تسجيل عودة ↩
                        </button>
                    </div>
                `;
            } else if (r.returned_at) {
                 actionOrStatus = `
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        ${statusBadge(r.status)}
                        <span style="font-size:11px; color:green; font-weight:bold;">تمت العودة ✅</span>
                    </div>
                 `;
            }

          return `
            <tr>
              <td>${r.request_id}</td>
              <td>${escapeHtml(r.leaveType?.type_name || "-")}</td>
              <td>${fmtDate(r.start_date)}</td>
              <td>${actionOrStatus}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="4" class="muted">لا يوجد طلبات حديثة.</td></tr>`;

  // 3. تحديث الإحصائيات (كما هي)
  const norm = (s) => String(s || "").toLowerCase();
  const approved = recent.filter((r) => norm(r.status).includes("approved")).length;
  const pending = recent.filter((r) => norm(r.status).includes("pending")).length;
  const rejected = recent.filter((r) => norm(r.status).includes("rejected")).length;
  const total = recent.length;
  
  const setStat = (id, valId, value) => {
    const el = qs(id);
    const bar = qs(valId);
    if (el) el.textContent = value.toLocaleString("ar-EG");
    if (bar) bar.style.width = Math.min(100, (total ? (value / total) * 100 : 0)) + "%";
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
  const today = new Date(); // Get current date for comparison

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
        .map((r) => {
            // Logic for Return Button
            const endDate = new Date(r.end_date);
            const isApproved = r.status === 'Approved';
            const isFinished = today > endDate; // Leave date has passed
            const notReturned = r.returned_at === null; // Hasn't clicked button yet

            // Determine what to show in the 4th column
            let actionHtml = `<button class="btn" data-view="${r.request_id}">عرض التفاصيل</button>`;

            // If ready to return, show "Return to Work" button instead
            if (isApproved && isFinished && notReturned) {
                actionHtml = `
                    <button class="btn" style="background-color: #014964; color: white;" 
                            onclick="submitReturnDeclaration(${r.request_id})">
                        تسجيل عودة
                    </button>
                    <button class="btn" data-view="${r.request_id}" style="margin-right:5px; font-size:12px;">تفاصيل</button>
                `;
            } else if (r.returned_at) {
                actionHtml += ` <span style="font-size:12px; color:green; display:block">تمت العودة ✅</span>`;
            }

            return `
            <tr>
              <td>${r.request_id}</td>
              <td>${escapeHtml(r.leaveType?.type_name || "-")}</td>
              <td>${statusBadge(r.status)}</td>
              <td>${actionHtml}</td>
            </tr>
          `;
        })
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

// ===== UPDATED LOAD PROFILE (With Role Check) =====
async function loadProfile() {
  try {
    const res = await apiFetch(`/api/profile`);
    const user = res?.data?.user;
    
    if (user) {
      currentUser = user;
      
      // 1. Fill Header Info
      const nameEl = qs("#userName");
      const avatarEl = qs("#userAvatar");
      const deptEl = qs("#userDepartment");
      const emailEl = qs("#userEmail"); // Optional if you want to keep using it somewhere

      if (nameEl) nameEl.textContent = user.name || "موظف";
      if (avatarEl) avatarEl.textContent = (user.name || "؟")[0];
      if (deptEl) deptEl.textContent = translateRole(user.role);

      // 2. Fill Dropdown Info
      const dropName = qs("#dropName");
      const dropRole = qs("#dropRole");
      if(dropName) dropName.textContent = user.name;
      if(dropRole) dropRole.textContent = translateRole(user.role);

      // 3. 🚀 CHECK ROLE FOR SWITCH BUTTON
      const switchBtn = qs("#switchRoleBtn");
      // Roles allowed to see the Manager Portal
      const managerRoles = ['Manager', 'Dean', 'Head_of_Department', 'HR_Admin'];
      
      if (switchBtn) {
          if (managerRoles.includes(user.role)) {
              switchBtn.style.display = 'flex'; // Show button
              // You can customize the link based on role if needed, e.g.:
              // if (user.role === 'HR_Admin') switchBtn.href = '../admin/admin.html';
          } else {
              switchBtn.style.display = 'none'; // Hide for normal employees
          }
      }

      // 4. Setup Dropdown Toggle
      const userInfoEl = qs("#userInfo");
      const dropdown = qs("#profileDropdown");

      if (userInfoEl && dropdown) {
          userInfoEl.onclick = (e) => {
              if(!e.target.closest('.dropdown-item')) {
                  e.stopPropagation();
                  dropdown.classList.toggle('active');
              }
          };

          document.addEventListener('click', (e) => {
              if (!dropdown.contains(e.target) && !userInfoEl.contains(e.target)) {
                  dropdown.classList.remove('active');
              }
          });
      }

      // 5. Logout Logic
      const logoutBtn = qs("#logoutBtn");
      if (logoutBtn) {
          logoutBtn.onclick = (e) => {
              e.preventDefault();
              clearToken();
              window.location.href = "../index.html"; 
          };
      }
    }
  } catch (e) {
    console.log("Could not load profile:", e.message);
  }
}

// Add this helper if not already in employee.js
function translateRole(role) {
    const map = {
        'Manager': 'مدير',
        'Dean': 'عميد الكلية',
        'Head_of_Department': 'رئيس القسم',
        'HR_Admin': 'الموارد البشرية',
        'Employee': 'موظف'
    };
    return map[role] || role;
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
    // 1. جمع البيانات
    const type_id = Number(qs("#typeSelect").value);
    const start_date = qs("#startDate").value;
    const end_date = qs("#endDate").value;
    const reason = qs("#reason").value.trim();
    const file = qs("#document").files?.[0] || null;
    
    // تعريف الـ Checkbox
    const ackCheckbox = qs("#acknowledgementCheckbox");

    // 2. التحقق من البيانات الأساسية
    if (!type_id || !start_date || !end_date || !reason) {
      toast("ناقص بيانات", "من فضلك املأ النوع + التواريخ + السبب");
      return;
    }

    // 🛑 3. التحقق من الإقرار (Check Validation)
    // هذا هو الكود المسؤول عن منع الإرسال
    if (!ackCheckbox || !ackCheckbox.checked) {
      toast("تنبيه", "⚠️ يجب وضع علامة صح على إقرار القيام بالإجازة.");
      return; // 👈 هذا الأمر يوقف الدالة تماماً ويمنع الوصول لكود الإرسال
    }

    // 4. التحقق من التواريخ
    const sd = new Date(start_date + "T00:00:00");
    const ed = new Date(end_date + "T00:00:00");
    if (ed < sd) {
      toast("تواريخ غير صحيحة", "End Date لازم يكون بعد Start Date");
      return;
    }

    // ... باقي الكود (FormData و apiFetch) ...
    const fd = new FormData();
    fd.append("type_id", String(type_id));
    fd.append("start_date", start_date);
    fd.append("end_date", end_date);
    fd.append("reason", reason);
    // نرسل القيمة true للسيرفر
    fd.append("pre_leave_acknowledgement", "true"); 

    if (file) fd.append("document", file);

    // الإرسال الفعلي
    await apiFetch(`/api/me/leave-requests`, {
      method: "POST",
      body: fd,
      isForm: true,
    });

    toast("تم الإرسال", "تم إنشاء الطلب بنجاح");
    
    // تنظيف الحقول
    qs("#reason").value = "";
    qs("#document").value = "";
    ackCheckbox.checked = false; // 👈 إزالة العلامة بعد النجاح
    
    await loadAll();
    switchTab("history");

  } catch (e) {
    toast("خطأ", e.message);
  }
});

// ==========================================
// 🔔 NOTIFICATION SYSTEM LOGIC (CONNECTED)
// ==========================================

// Global variable to hold data
let myNotifications = [];

// 1. Master Load Function (Loads List & Count in parallel)
async function loadNotifications() {
    await Promise.all([
        fetchNotificationList(),
        fetchUnreadCount()
    ]);
}

// 2. Fetch The List (The 20 most recent)
async function fetchNotificationList() {
    const notifList = document.getElementById('notifList');
    const emptyState = document.getElementById('emptyState');
    
    try {
        // Calls: GET /api/notifications
        const res = await apiFetch('/api/notifications'); 
        
        // Based on your controller: res.data is the array (data.rows)
        const data = res.data || [];
        myNotifications = data;

        // Clear current HTML list
        notifList.innerHTML = '';

        // Handle Empty State
        if (myNotifications.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Render Items
        myNotifications.forEach(notif => {
            // Check if read or unread
            const isUnread = !notif.is_read; 
            const itemClass = isUnread ? 'notif-item unread' : 'notif-item';
            
            // Icon & Color Logic based on Title/Type
            let icon = '<i class="fa-solid fa-circle-info"></i>';
            let bgClass = 'primary-bg'; 

            const title = (notif.title || "").toLowerCase();
            const type = (notif.type || "").toUpperCase();

            // Customize icons
            if (type === 'SUCCESS' || title.includes('قبول') || title.includes('approved')) {
                icon = '<i class="fa-solid fa-check"></i>';
                bgClass = 'success-bg'; 
            } else if (type === 'WARNING' || title.includes('مراجعة') || title.includes('pending')) {
                icon = '<i class="fa-solid fa-hourglass-half"></i>';
                bgClass = 'warning-bg'; 
            } else if (type === 'ERROR' || title.includes('رفض') || title.includes('rejected')) {
                icon = '<i class="fa-solid fa-xmark"></i>';
                bgClass = 'danger-bg'; 
            }

            // Create HTML Element
            const li = document.createElement('div');
            li.className = itemClass;
            
            // Use correct ID field
            const nId = notif.notification_id || notif.id; 

            li.innerHTML = `
                <div class="notif-icon ${bgClass}">
                    ${icon}
                </div>
                <div class="notif-content">
                    <h4>${escapeHtml(notif.title)}</h4>
                    <p>${escapeHtml(notif.message)}</p>
                    <span class="time">${fmtDate(notif.created_at)}</span>
                </div>
                ${isUnread ? `
                <button class="mark-read-btn" onclick="markAsRead(${nId}, event)" title="تحديد كمقروء">
                    <i class="fa-solid fa-check-double"></i>
                </button>` : ''}
            `;
            notifList.appendChild(li);
        });

    } catch (e) {
        console.error("Failed to load notifications list", e);
        notifList.innerHTML = `<div class="muted" style="padding:10px; text-align:center;">فشل تحميل الإشعارات</div>`;
    }
}

// 3. Fetch Unread Count (For the Red Badge)
async function fetchUnreadCount() {
    // 1. هل العنصر موجود؟
    const badge = document.querySelector('.badge-count');
    console.log("🔍 Badge Element Found?", badge); // يجب أن يطبع العنصر، ليس null

    if (!badge) return;

    try {
        // 2. ماذا يرجع السيرفر؟
        const res = await apiFetch('/api/notifications/unread-count');
        console.log("📩 API Response:", res); 

        // 3. تحويل القيمة لرقم
        const count = Number(res.data) || 0;
        console.log("🔢 Parsed Count:", count);

        if (count > 0) {
            badge.style.display = 'flex';
            badge.innerText = count > 99 ? '99+' : count;
            console.log("✅ Showing Badge");
        } else {
            badge.style.display = 'none';
            console.log("🙈 Hiding Badge (Count is 0)");
        }
    } catch (e) {
        console.error("❌ Failed to load unread count", e);
    }
}

// 4. Mark Single Item Read
async function markAsRead(id, event) {
    if(event) event.stopPropagation(); // Prevent clicking the item container

    try {
        // Calls: PATCH /api/notifications/:id/read
        await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
        
        // Reload list and count to sync UI
        loadNotifications();
        
    } catch (e) {
        toast("خطأ", "تعذر تحديث حالة الإشعار");
    }
}

// 5. Mark All Read
const markAllBtn = document.getElementById('markAllBtn');
if(markAllBtn) {
    markAllBtn.addEventListener('click', async () => {
        try {
            // Calls: PATCH /api/notifications/mark-all-read
            await apiFetch(`/api/notifications/mark-all-read`, { method: 'PATCH' });
            
            toast("تم", "تم تحديد الكل كمقروء");
            loadNotifications(); // Refresh UI
        } catch (e) {
            toast("خطأ", "حدث خطأ أثناء التحديث");
        }
    });
}

// 6. Initialization (DOMContentLoaded)
document.addEventListener('DOMContentLoaded', function() {
    const notifBtn = document.querySelector('button[title="الاشعارات"]');
    const dropdown = document.getElementById('notificationDropdown');

    if(notifBtn && dropdown) {
        // Toggle Menu
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
            
            // Reload data when opening to ensure freshness
            if (dropdown.classList.contains('active')) {
                loadNotifications();
            }
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !notifBtn.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    }

    // Initial Load when page starts
    loadNotifications();

    // Optional: Auto-refresh every 60 seconds to check for new messages
    setInterval(loadNotifications, 60000);
});

// ✅ NEW: Function to handle "Return to Work"
// دالة عرض نافذة تأكيد العودة للعمل (بشكل احترافي)
function submitReturnDeclaration(requestId) {
  // 1. فتح المودال بتصميم الإقرار
  openModal(`
    <div class="modal-header" style="background: linear-gradient(135deg, #014964 0%, #026082 100%);">
      <div class="modal-title">
        <span class="modal-icon">↩️</span>
        <div>
          <h2>إقرار عودة للعمل</h2>
          <span class="modal-subtitle">تأكيد استئناف العمل بعد الإجازة</span>
        </div>
      </div>
      <button class="modal-close-btn" onclick="closeModal()">
        <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="modal-body" style="padding: 24px; text-align: center;">
      <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
        <p style="font-size: 16px; line-height: 1.6; color: #014964; font-weight: 600; margin: 0;">
          "أقر بأنني استأنفت أعمالي المصلحية في الكلية/الجامعة عقب انتهاء الإجازة المرخص لي بها، وذلك اعتباراً من تاريخ اليوم."
        </p>
      </div>

      <div class="actions" style="justify-content: center; gap: 16px;">
        <button id="confirmReturnBtn" class="btn primary" style="background-color: #014964; font-size: 16px; padding: 12px 32px;">
          تأكيد العودة
        </button>
        <button class="btn" onclick="closeModal()" style="font-size: 16px;">إلغاء</button>
      </div>
    </div>
  `);

  // 2. إضافة الأكشن لزر التأكيد بعد رسم المودال
  // ننتظر قليلاً لضمان وجود الزر في الصفحة
  setTimeout(() => {
    const confirmBtn = document.getElementById("confirmReturnBtn");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", async () => {
        try {
          // تغيير نص الزر أثناء التحميل
          confirmBtn.textContent = "جاري التسجيل...";
          confirmBtn.disabled = true;

          // استدعاء الـ API
          await apiFetch(`/api/me/requests/${requestId}/return`, {
            method: "POST"
          });

          toast("تم بنجاح", "تم تسجيل إقرار العودة للعمل.");
          closeModal();
          await loadRequests(); // تحديث الجدول لإخفاء الزر
          
          // تحديث لوحة التحكم أيضاً إذا كنا فيها
          if (document.getElementById("view-dashboard").classList.contains("active")) {
             loadDashboard();
          }

        } catch (e) {
          toast("خطأ", e.message);
          confirmBtn.textContent = "تأكيد العودة";
          confirmBtn.disabled = false;
        }
      });
    }
  }, 50);
}
// auto-load
loadAll();
