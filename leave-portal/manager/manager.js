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
        .map(
          (r) => `
    <tr>
      <td>${escapeHtml(r.employeeName || "-")}</td>
      <td>${escapeHtml(r.department || "-")}</td>
      <td>${escapeHtml(r.leaveType || "-")}</td>
      <td>${fmtDate(r.startDate)}</td>
      <td>${fmtDate(r.endDate)}</td>
      <td>${r.duration || "-"} يوم</td>
      <td>${statusBadge(r.status)}</td>
      <td>${fmtDate(r.createdAt)}</td>
    </tr>
  `
        )
        .join("")
    : `<tr><td colspan="8" class="muted">لا يوجد بيانات.</td></tr>`;
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
    await Promise.all([loadDashboard(), loadReports(), loadTeamOnLeave()]);
    toast("تمام", "اتحدثت البيانات بنجاح");
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


loadAll();
