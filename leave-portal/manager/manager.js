// // ===== PROTECTION LOGIC (Add at the top) =====
// (function protectManagerPage() {
//     const user = JSON.parse(localStorage.getItem('user'));

//     // 1. Check Login
//     if (!user || !localStorage.getItem('token')) {
//         window.location.href = '../index.html'; // Or login.html
//         return;
//     }

//     // 2. Check Role Authorization
//     const allowedRoles = ['Manager', 'Dean', 'Head_of_Department', 'HR_Admin'];

//     // If role is NOT in the allowed list, redirect to employee dashboard
//     if (!allowedRoles.includes(user.role)) {
//         alert("عفواً، ليس لديك صلاحية للوصول لبوابة المدير.");
//         window.location.href = '../employee/employee.html';
//     }
// })();

// ===== Page: Manager =====
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
  localStorage.setItem("managerActiveTab", tabName);
}

// Initialize tabs
qsa(".nav-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

// Restore last active tab
const savedTab = localStorage.getItem("managerActiveTab");
if (savedTab) {
  switchTab(savedTab);
}

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
  toast("تم المسح", "تم مسح التوكن");
});

qs("#refreshBtn").addEventListener("click", () => loadAll());

let dashboard = null;

function renderStats(data) {
  const pendingApprovals = data?.pendingApprovals || [];
  const pending = pendingApprovals.length;

  qs("#statPending").textContent = pending.toLocaleString("ar-EG");

  // Update badge
  qs("#pendingCount").textContent = pending;
}
async function loadDashboard() {
  const res = await apiFetch(`/api/me/dashboard`);
  renderDashboard(res?.data);
}

// ===== UPDATE THIS FUNCTION =====
// ===== UPDATED LOAD PROFILE FUNCTION =====
// ===== UPDATED LOAD PROFILE FUNCTION (Fixed Link) =====
// ===== UPDATED LOAD PROFILE FUNCTION (For Manager.js) =====
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

      if (nameEl) nameEl.textContent = user.name || "المدير";
      if (avatarEl) avatarEl.textContent = (user.name || "م")[0];
      if (deptEl) deptEl.textContent = translateRole(user.role);

      // 2. Fill Dropdown Info
      const dropName = qs("#dropName");
      const dropRole = qs("#dropRole");
      if (dropName) dropName.textContent = user.name;
      if (dropRole) dropRole.textContent = translateRole(user.role);

      // 3. Setup Dropdown Toggle
      const userInfoEl = qs("#userInfo");
      const dropdown = qs("#profileDropdown");

      if (userInfoEl && dropdown) {
        userInfoEl.onclick = (e) => {
          // Only toggle if we didn't click a link inside
          if (!e.target.closest(".dropdown-item")) {
            e.stopPropagation();
            dropdown.classList.toggle("active");
          }
        };

        // Close when clicking outside
        document.addEventListener("click", (e) => {
          if (!dropdown.contains(e.target) && !userInfoEl.contains(e.target)) {
            dropdown.classList.remove("active");
          }
        });
      }

      // 4. ✅ FIX: Set Link to Go TO Employee Portal
      const switchBtn = qs("#switchRoleBtn");
      if (switchBtn) {
        // This sets the correct path relative to the manager folder
        switchBtn.href = "../employee/employee.html";
      }

      // 5. Setup Logout Logic
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

// Helper to Translate Roles
function translateRole(role) {
  const map = {
    Manager: "مدير",
    Dean: "عميد الكلية",
    Head_of_Department: "رئيس القسم",
    HR_Admin: "الموارد البشرية",
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
function getLeaveType(x) {
  return (
    x.request?.leaveType?.type_name ||
    x.request?.type ||
    x.request?.leaveType ||
    x.type ||
    x.leaveType?.type_name ||
    x.leaveType ||
    "-"
  );
}

function getStartDate(x) {
  return (
    x.request?.start_date ||
    x.request?.startDate ||
    x.start_date ||
    x.startDate ||
    null
  );
}

function getEndDate(x) {
  return (
    x.request?.end_date || x.request?.endDate || x.end_date || x.endDate || null
  );
}

function getEmployeeName(x) {
  return (
    x.request?.user?.name ||
    x.request?.employee?.name ||
    x.user?.name ||
    x.employee?.name ||
    x.employeeName ||
    "-"
  );
}

function renderPendingFromDashboard(data) {
  const arr = data?.pendingApprovals || [];

  // Render in dashboard quick view
  const dashBody = qs("#dashboardPendingBody");
  dashBody.innerHTML = arr.length
    ? arr
        .slice(0, 5)
        .map(
          (x) => `
    <tr>
      <td><strong>${x.step_id}</strong></td>
      <td><strong>${escapeHtml(
        x.request?.request_id || x.request_id || "-"
      )}</strong></td>
      <td>${escapeHtml(getEmployeeName(x))}</td>
      <td>${escapeHtml(getLeaveType(x))}</td>
      <td>${fmtDate(getStartDate(x))}</td>
      <td>${fmtDate(getEndDate(x))}</td>
      <td>${statusBadge(x.status)}</td>
      <td><button class="btn" data-open="${x.step_id}">عرض</button></td>
    </tr>
  `
        )
        .join("")
    : `<tr><td colspan="8" class="muted">لا يوجد مهام Pending.</td></tr>`;

  // Render in pending tab
  const pendingBody = qs("#pendingBody");
  pendingBody.innerHTML = arr.length
    ? arr
        .map(
          (x) => `
    <tr>
      <td><strong>${x.step_id}</strong></td>
      <td><strong>${escapeHtml(
        x.request?.request_id || x.request_id || "-"
      )}</strong></td>
      <td>${escapeHtml(getEmployeeName(x))}</td>
      <td>${escapeHtml(getLeaveType(x))}</td>
      <td>${fmtDate(getStartDate(x))}</td>
      <td>${fmtDate(getEndDate(x))}</td>
      <td>${statusBadge(x.status)}</td>
      <td><button class="btn" data-open="${x.step_id}">عرض</button></td>
    </tr>
  `
        )
        .join("")
    : `<tr><td colspan="8" class="muted">لا يوجد مهام Pending.</td></tr>`;

  // Wire open buttons
  qsa("button[data-open]", dashBody).forEach((btn) => {
    btn.addEventListener("click", () =>
      openTask(btn.getAttribute("data-open"))
    );
  });
  qsa("button[data-open]", pendingBody).forEach((btn) => {
    btn.addEventListener("click", () =>
      openTask(btn.getAttribute("data-open"))
    );
  });
}

async function openTask(stepId) {
  try {
    const res = await apiFetch(`/api/manager/approval-tasks/${stepId}`);
    const d = res?.data?.data || res?.data;

    const req = d?.request || {};
    const emp = d?.employee || {};
    const bal = d?.employeeBalance || {};
    const hist = Array.isArray(d?.history) ? d.history : [];
    const attachments = Array.isArray(req.attachments) ? req.attachments : [];

    // Get leave type properly
    const leaveType = req?.leaveType?.type_name || req?.type || "-";
    const startDate = req?.start_date || req?.startDate;
    const endDate = req?.end_date || req?.endDate;

    openModal(`
      <div class="modal-header">
        <div class="modal-title">
          <span class="modal-icon">📋</span>
          <div>
            <h2>طلب إجازة #${escapeHtml(
              req?.request_id || req?.id || stepId
            )}</h2>
            <span class="modal-subtitle">${statusBadge(d?.status)}</span>
          </div>
        </div>
        <button class="modal-close-btn" onclick="closeModal()">
          <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- Employee Info Card -->
        <div class="info-card employee-card">
          <div class="info-card-header">
            <div class="avatar">${escapeHtml((emp?.name || "?")[0])}</div>
            <div class="employee-info">
              <h3>${escapeHtml(emp?.name || "-")}</h3>
              <span class="department-badge">${escapeHtml(
                emp?.department || "-"
              )}</span>
            </div>
          </div>
          <div class="employee-email">${escapeHtml(emp?.email || "-")}</div>
          <div class="balance-row">
            <div class="balance-item">
              <span class="balance-value">${bal.total ?? "-"}</span>
              <span class="balance-label">إجمالي</span>
            </div>
            <div class="balance-item">
              <span class="balance-value used">${bal.used ?? "-"}</span>
              <span class="balance-label">مستخدم</span>
            </div>
            <div class="balance-item">
              <span class="balance-value remaining">${
                bal.remaining ?? "-"
              }</span>
              <span class="balance-label">متبقي</span>
            </div>
          </div>
        </div>

        <!-- Request Details Card -->
        <div class="info-card request-card">
          <h4>📝 تفاصيل الطلب</h4>
          <div class="request-details">
            <div class="detail-row">
              <span class="detail-icon">🏷️</span>
              <div class="detail-content">
                <span class="detail-label">نوع الإجازة</span>
                <span class="detail-value highlight">${escapeHtml(
                  leaveType
                )}</span>
              </div>
            </div>
            <div class="detail-row">
              <span class="detail-icon">📅</span>
              <div class="detail-content">
                <span class="detail-label">من</span>
                <span class="detail-value">${fmtDate(startDate)}</span>
              </div>
            </div>
            <div class="detail-row">
              <span class="detail-icon">📅</span>
              <div class="detail-content">
                <span class="detail-label">إلى</span>
                <span class="detail-value">${fmtDate(endDate)}</span>
              </div>
            </div>
            <div class="detail-row">
              <span class="detail-icon">⏱️</span>
              <div class="detail-content">
                <span class="detail-label">المدة</span>
                <span class="detail-value">${escapeHtml(
                  req?.duration ?? "-"
                )} يوم</span>
              </div>
            </div>
            ${
              req?.reason
                ? `
            <div class="detail-row reason-row">
              <span class="detail-icon">💬</span>
              <div class="detail-content">
                <span class="detail-label">السبب</span>
                <span class="detail-value reason-text">${escapeHtml(
                  req.reason
                )}</span>
              </div>
            </div>
            `
                : ""
            }
          </div>
        </div>

        <!-- Attachments -->
        ${
          attachments.length
            ? `
        <div class="info-card attachments-card">
          <h4>📎 المرفقات</h4>
          <div class="attachments-list">
            ${attachments
              .map(
                (a, i) => `
              <a href="${escapeHtml(
                a.filePath || "#"
              )}" target="_blank" rel="noopener" class="attachment-item">
                <span class="attachment-icon">📄</span>
                <span class="attachment-name">${escapeHtml(
                  a.fileName || `مرفق ${i + 1}`
                )}</span>
                <span class="attachment-action">فتح ←</span>
              </a>
            `
              )
              .join("")}
          </div>
        </div>
        `
            : ""
        }

        <!-- Approval History -->
        ${
          hist.length
            ? `
        <div class="info-card history-card">
          <h4>📜 سجل الموافقات</h4>
          <div class="history-timeline">
            ${hist
              .map(
                (h, i) => `
              <div class="timeline-item">
                <div class="timeline-dot ${(
                  h.status || ""
                ).toLowerCase()}"></div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span class="timeline-step">الخطوة ${escapeHtml(
                      h.step ?? i + 1
                    )}</span>
                    ${statusBadge(h.status)}
                  </div>
                  <div class="timeline-approver">${escapeHtml(
                    h.approver || "-"
                  )}</div>
                  ${
                    h.comments
                      ? `<div class="timeline-comment">"${escapeHtml(
                          h.comments
                        )}"</div>`
                      : ""
                  }
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
        `
            : ""
        }
      </div>

      <!-- Action Footer -->
      <div class="modal-footer">
        <div class="comments-section">
          <label>💬 ملاحظات المدير</label>
          <textarea id="managerComments" placeholder="اكتب ملاحظاتك هنا... (مطلوب للرفض)"></textarea>
        </div>
        <div class="action-buttons">
          <button class="action-btn approve-btn" id="approveBtn">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            موافقة
          </button>
          <button class="action-btn reject-btn" id="rejectBtn">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            رفض
          </button>
        </div>
      </div>
    `);

    // wire actions
    qs("#approveBtn").addEventListener("click", async () => {
      try {
        const comments = qs("#managerComments").value.trim();
        await apiFetch(`/api/manager/approval-tasks/${stepId}/approve`, {
          method: "POST",
          body: { comments },
        });
        toast("تم", "تمت الموافقة بنجاح");
        closeModal();
        await loadAll();
      } catch (e) {
        toast("خطأ", e.message);
      }
    });

    qs("#rejectBtn").addEventListener("click", async () => {
      const comments = qs("#managerComments").value.trim();
      if (!comments) {
        toast("ناقص", "يجب كتابة سبب الرفض في الملاحظات");
        return;
      }
      try {
        await apiFetch(`/api/manager/approval-tasks/${stepId}/reject`, {
          method: "POST",
          body: { comments },
        });
        toast("تم", "تم رفض الطلب بنجاح");
        closeModal();
        await loadAll();
      } catch (e) {
        toast("خطأ", e.message);
      }
    });
  } catch (e) {
    toast("خطأ", e.message);
  }
}

async function loadDashboard() {
  const res = await apiFetch(`/api/manager/dashboard`);
  const d = res?.data?.data || res?.data;
  console.log("Dashboard data:", d);
  console.log("Pending approvals:", d?.pendingApprovals);
  if (d?.pendingApprovals?.length > 0) {
    console.log(
      "First pending item structure:",
      JSON.stringify(d.pendingApprovals[0], null, 2)
    );
  }
  dashboard = d;
  renderStats(d);
  renderPendingFromDashboard(d);
}

let reportsData = null;

async function loadReports() {
  try {
    const res = await apiFetch(`/api/manager/reports`);
    const d = res?.data?.data || res?.data;
    reportsData = d;
    renderReports(d);
  } catch (e) {
    toast("خطأ", e.message);
  }
}

function renderReports(data) {
  const stats = data?.statistics || {};
  const report = data?.report || [];

  const total = stats.total ?? 0;
  const approved = stats.approved ?? 0;
  const pending = stats.pending ?? 0;
  const rejected = stats.rejected ?? 0;

  // Update stats
  qs("#reportTotal").textContent = total.toLocaleString("ar-EG");
  qs("#reportApproved").textContent = approved.toLocaleString("ar-EG");
  qs("#reportPending").textContent = pending.toLocaleString("ar-EG");
  qs("#reportRejected").textContent = rejected.toLocaleString("ar-EG");

  // Update bars
  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
  qs("#reportApprovedBar").style.width = pct(approved) + "%";
  qs("#reportPendingBar").style.width = pct(pending) + "%";
  qs("#reportRejectedBar").style.width = pct(rejected) + "%";

  // Render table
  const body = qs("#reportsBody");

  body.innerHTML = report.length
    ? report
        .map((r) => {
          // 🟢 START OF NEW CODE: Handling Comments nicely
          let commentsHtml = "-";

          if (Array.isArray(r.comments) && r.comments.length > 0) {
            commentsHtml = r.comments
              .map(
                (c) => `
    <div style="
        background-color: #fff; 
        border: 1px solid #e2e8f0; 
        border-radius: 8px; 
        padding: 8px 12px; 
        margin-bottom: 6px; 
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        font-family: 'Tajawal', sans-serif;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-weight: 700; color: #1e293b; font-size: 13px;">
              ${escapeHtml(c.approver || "Unknown")}
          </span>
          <span style="
              background-color: #f1f5f9; 
              color: #475569; 
              padding: 2px 6px; 
              border-radius: 4px; 
              font-size: 10px; 
              font-weight: 600;
          ">
              ${escapeHtml(c.role || "Approver")}
          </span>
      </div>
      
      <div style="
          color: #334155; 
          font-size: 13px; 
          line-height: 1.5; 
          font-weight: 500;
      ">
          ${escapeHtml(c.comment || "")}
      </div>
    </div>
  `
              )
              .join("");
          }
          // 🔴 END OF NEW CODE

          return `
        <tr>
          <td>${escapeHtml(r.employeeName || "-")}</td>
          <td>${escapeHtml(r.department || "-")}</td>
          <td>${escapeHtml(r.leaveType || "-")}</td>
          <td>${fmtDate(r.startDate)}</td>
          <td>${fmtDate(r.endDate)}</td>
          <td>${r.duration || "-"} يوم</td>
          <td>${statusBadge(r.status)}</td>
          <td>${fmtDate(r.createdAt)}</td>
          
          <td style="max-width: 250px; text-align: right; vertical-align: top;">
             ${commentsHtml}
          </td>
        </tr>
      `;
        })
        .join("")
    : `<tr><td colspan="9" class="muted">لا يوجد بيانات.</td></tr>`;
}

// Wire reports button
qs("#loadReportsBtn")?.addEventListener("click", () => loadReports());

// Team on Leave
let teamOnLeaveData = null;

async function loadTeamOnLeave() {
  try {
    const res = await apiFetch(`/api/manager/team-on-leave`);
    const d = res?.data?.data || res?.data;
    teamOnLeaveData = d;
    renderTeamOnLeave(d);
  } catch (e) {
    toast("خطأ", e.message);
  }
}

function renderTeamOnLeave(data) {
  const count = data?.count ?? 0;
  const employees = data?.employees || [];

  // Update stats
  qs("#teamLeaveTotal").textContent = count.toLocaleString("ar-EG");
  qs("#teamLeaveCount").textContent = count;

  // Render table
  const body = qs("#teamLeaveBody");
  const emptyState = qs("#teamLeaveEmpty");
  const tableWrap = body?.closest(".table-wrap");

  if (employees.length === 0) {
    if (tableWrap) tableWrap.style.display = "none";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (tableWrap) tableWrap.style.display = "block";
  if (emptyState) emptyState.style.display = "none";

  body.innerHTML = employees
    .map(
      (e) => `
    <tr>
      <td><strong>${escapeHtml(e.employeeName || e.name || "-")}</strong></td>
      <td>${escapeHtml(e.department || "-")}</td>
      <td>${escapeHtml(e.leaveType || "-")}</td>
      <td>${fmtDate(e.startDate || e.start_date)}</td>
      <td>${fmtDate(e.endDate || e.end_date)}</td>
      <td>${e.duration || "-"} يوم</td>
    </tr>
  `
    )
    .join("");
}

// Wire team leave button
qs("#loadTeamLeaveBtn")?.addEventListener("click", () => loadTeamOnLeave());

async function loadAll() {
  try {
    toast("تحميل", "جاري جلب بيانات المدير...");
    loadNotifications();
    fetchUnreadCount();
    // ✅ يجب إضافة loadProfile() هنا ليعمل الهيدر
    await Promise.all([
      loadProfile(),
      loadDashboard(),
      loadReports(),
      loadTeamOnLeave(),
    ]);
    toast("تمام", "تم تحديث البيانات بنجاح");
  } catch (e) {
    toast("خطأ", e.message);
  }
}

// ==========================================
// 🔔 NOTIFICATION SYSTEM LOGIC (CONNECTED)
// ==========================================

// Global variable to hold data
let myNotifications = [];

// 1. Master Load Function (Loads List & Count in parallel)
async function loadNotifications() {
  await Promise.all([fetchNotificationList(), fetchUnreadCount()]);
}

// 2. Fetch The List (The 20 most recent)
async function fetchNotificationList() {
  const notifList = document.getElementById("notifList");
  const emptyState = document.getElementById("emptyState");

  try {
    // Calls: GET /api/notifications
    const res = await apiFetch("/api/notifications");

    // Based on your controller: res.data is the array (data.rows)
    const data = res.data || [];
    myNotifications = data;

    // Clear current HTML list
    notifList.innerHTML = "";

    // Handle Empty State
    if (myNotifications.length === 0) {
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";

    // Render Items
    myNotifications.forEach((notif) => {
      // Check if read or unread
      const isUnread = !notif.is_read;
      const itemClass = isUnread ? "notif-item unread" : "notif-item";

      // Icon & Color Logic based on Title/Type
      let icon = '<i class="fa-solid fa-circle-info"></i>';
      let bgClass = "primary-bg";

      const title = (notif.title || "").toLowerCase();
      const type = (notif.type || "").toUpperCase();

      // Customize icons
      if (
        type === "SUCCESS" ||
        title.includes("قبول") ||
        title.includes("approved")
      ) {
        icon = '<i class="fa-solid fa-check"></i>';
        bgClass = "success-bg";
      } else if (
        type === "WARNING" ||
        title.includes("مراجعة") ||
        title.includes("pending")
      ) {
        icon = '<i class="fa-solid fa-hourglass-half"></i>';
        bgClass = "warning-bg";
      } else if (
        type === "ERROR" ||
        title.includes("رفض") ||
        title.includes("rejected")
      ) {
        icon = '<i class="fa-solid fa-xmark"></i>';
        bgClass = "danger-bg";
      }

      // Create HTML Element
      const li = document.createElement("div");
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
                ${
                  isUnread
                    ? `
                <button class="mark-read-btn" onclick="markAsRead(${nId}, event)" title="تحديد كمقروء">
                    <i class="fa-solid fa-check-double"></i>
                </button>`
                    : ""
                }
            `;
      notifList.appendChild(li);
    });
  } catch (e) {
    console.error("Failed to load notifications list", e);
    notifList.innerHTML = `<div class="muted" style="padding:10px; text-align:center;">فشل تحميل الإشعارات</div>`;
  }
}

// 3. Fetch Unread Count (For the Red Badge)
// 3. Fetch Unread Count (Universal Fix for Manager)
async function fetchUnreadCount() {
  const badge = document.querySelector(".badge-count");

  // 1. Safety Check
  if (!badge) return;

  try {
    const res = await apiFetch("/api/notifications/unread-count");

    // Debugging
    console.log("📩 Manager Unread Count Response:", res);

    let finalCount = 0;

    // --- LOGIC TO HANDLE ALL BACKEND FORMATS ---

    // Case A: Backend sends { data: 5 } (Raw Number)
    if (typeof res.data === "number") {
      finalCount = res.data;
    }
    // Case B: Backend sends { count: 5 } (Top level key)
    else if (typeof res.count === "number") {
      finalCount = res.count;
    }
    // Case C: Backend sends { data: { count: 5 } } (Object wrapper)
    else if (res.data && typeof res.data === "object") {
      finalCount =
        res.data.count || res.data.unreadCount || res.data.unread || 0;
    }

    console.log("🔢 Final Manager Count:", finalCount);

    // --- UPDATE UI ---
    if (finalCount > 0) {
      badge.style.display = "flex";
      badge.innerText = finalCount > 99 ? "99+" : finalCount;
      // Optional: Add animation class if you have css for it
      // badge.classList.add('pulse-animation');
    } else {
      badge.style.display = "none";
    }
  } catch (e) {
    console.error("❌ Failed to load manager unread count", e);
    badge.style.display = "none";
  }
}

// 4. Mark Single Item Read
async function markAsRead(id, event) {
  if (event) event.stopPropagation(); // Prevent clicking the item container

  try {
    // Calls: PATCH /api/notifications/:id/read
    await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });

    // Reload list and count to sync UI
    loadNotifications();
  } catch (e) {
    toast("خطأ", "تعذر تحديث حالة الإشعار");
  }
}

// 5. Mark All Read
const markAllBtn = document.getElementById("markAllBtn");
if (markAllBtn) {
  markAllBtn.addEventListener("click", async () => {
    try {
      // Calls: PATCH /api/notifications/mark-all-read
      await apiFetch(`/api/notifications/mark-all-read`, { method: "PATCH" });

      toast("تم", "تم تحديد الكل كمقروء");
      loadNotifications(); // Refresh UI
    } catch (e) {
      toast("خطأ", "حدث خطأ أثناء التحديث");
    }
  });
}

// 6. Initialization (DOMContentLoaded)
document.addEventListener("DOMContentLoaded", function () {
  const notifBtn = document.querySelector('button[title="الاشعارات"]');
  const dropdown = document.getElementById("notificationDropdown");

  if (notifBtn && dropdown) {
    // Toggle Menu
    notifBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("active");

      // Reload data when opening to ensure freshness
      if (dropdown.classList.contains("active")) {
        loadNotifications();
      }
    });

    // Close on click outside
    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target) && !notifBtn.contains(e.target)) {
        dropdown.classList.remove("active");
      }
    });
  }

  // Initial Load when page starts
  loadNotifications();
  fetchUnreadCount();
  // Optional: Auto-refresh every 60 seconds to check for new messages
  setInterval(() => {
    loadNotifications();
    fetchUnreadCount();
  }, 60000);
});

// ==========================================
// 📊 EXPORT TO EXCEL LOGIC
// ==========================================

function exportReportsToExcel() {
  // 1. Check if data exists
  if (!reportsData || !reportsData.report || reportsData.report.length === 0) {
    toast("تنبيه", "لا يوجد بيانات لتصديرها");
    return;
  }

  // 2. Define Arabic Headers
  const headers = [
    "اسم الموظف",
    "القسم",
    "نوع الإجازة",
    "تاريخ البداية",
    "تاريخ النهاية",
    "المدة (أيام)",
    "الحالة",
    "تاريخ الطلب",
  ];

  // 3. Map Data Rows
  const rows = reportsData.report.map((r) => {
    return [
      `"${r.employeeName || "-"}"`, // Wrap in quotes to handle commas in names
      `"${r.department || "-"}"`,
      `"${r.leaveType || "-"}"`,
      fmtDate(r.startDate),
      fmtDate(r.endDate),
      r.duration || 0,
      `"${translateStatusForExcel(r.status)}"`, // Translate status to Arabic
      fmtDate(r.createdAt),
    ].join(","); // Join columns with comma
  });

  // 4. Combine Headers and Rows
  const csvContent = [headers.join(","), ...rows].join("\n");

  // 5. Create Blob with BOM (Byte Order Mark) for Arabic Support
  // \uFEFF is crucial for Excel to recognize Arabic characters correctly
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  // 6. Trigger Download
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `تقرير_الاجازات_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Helper to translate status for the Excel file (Plain text, no HTML)
function translateStatusForExcel(status) {
  const s = String(status).toLowerCase();
  if (s.includes("approve")) return "مقبول";
  if (s.includes("reject")) return "مرفوض";
  if (s.includes("pend")) return "قيد الانتظار";
  return status;
}
// Wire Export Button
const exportBtn = document.getElementById("exportReportBtn");
if (exportBtn) {
  exportBtn.addEventListener("click", exportReportsToExcel);
}

loadAll();
