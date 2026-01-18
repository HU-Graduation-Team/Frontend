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

qs("#refreshBtn").addEventListener("click", () => loadAll());
qs("#loadRequestsBtn").addEventListener("click", () => loadRequests());

qs("#resetBtn").addEventListener("click", () => {
  qs("#startDate").value = "";
  qs("#endDate").value = "";
  qs("#reason").value = "";
  qs("#document").value = "";
  toast("تم", "اتعمل Reset للفورم", "success");
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
    .map((t) => {
      // Logic for Badges
      const isPaid = t.is_paid 
        ? '<span class="tag" style="color: #10b981; background: #dcfce7;">💰 مدفوعة</span>' 
        : '<span class="tag" style="color: #ef4444; background: #fee2e2;">🚫 غير مدفوعة</span>';
      
      const deduct = t.deduct_from_balance 
        ? '<span class="tag" style="color: #f59e0b; background: #fef3c7;">📉 تخصم</span>' 
        : '<span class="tag" style="color: #3b82f6; background: #dbeafe;">✨ لا تخصم</span>';

      return `
        <div class="type-card">
          <div class="type-card-header">
            <div class="name">${escapeHtml(t.type_name)}</div>
          </div>
          <div class="desc">${escapeHtml(t.description || "لا يوجد وصف")}</div>
          <div class="meta" style="gap:8px;">
            ${isPaid}
            ${deduct}
            <span class="tag"><b>الحد الأقصى:</b> ${t.max_days_per_request ? t.max_days_per_request + ' يوم' : 'مفتوح'}</span>
          </div>
        </div>
      `;
    })
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
  const delegateWrap = qs("#delegateWrapper");
  const docsContainer = qs("#dynamicDocsContainer");

  // 1. Reset UI
  docsContainer.innerHTML = "";
  if (delegateWrap) delegateWrap.style.display = "none";
  if (hint) hint.textContent = "";

  if (!t) return;

  // 2. Update Hint with Policy Details
  const limitTxt = t.max_days_per_request ? `أقصى مدة: ${t.max_days_per_request} يوم` : 'المدة: مفتوحة';
  const paidTxt = t.is_paid ? 'مدفوعة الأجر' : 'غير مدفوعة';
  const deductTxt = t.deduct_from_balance ? 'تخصم من الرصيد' : 'لا تخصم من الرصيد';
  
  if (hint) {
    hint.innerHTML = `
      <span style="display:inline-block; margin-left:10px; background:#f1f5f9; padding:2px 8px; border-radius:4px;">${limitTxt}</span>
      <span style="display:inline-block; margin-left:10px; color:${t.is_paid ? '#059669' : '#dc2626'}">${paidTxt}</span>
      <span style="display:inline-block; color:#4b5563">${deductTxt}</span>
    `;
  }

  // 3. Handle Delegate
  const rawDelegateVal = t.requires_delegate ?? t.requiresDelegate;
  const needsDelegate = Boolean(rawDelegateVal) === true;

  if (needsDelegate && delegateWrap) {
    delegateWrap.style.display = "block";
    loadDelegates();
  }

  // 4. Handle Dynamic Documents
  const requirements = t.requiredDocuments || t.document_requirements || [];

  if (requirements.length > 0) {
    requirements.forEach((doc) => {
      const div = document.createElement("div");
      div.className = "form-group";

      const label = document.createElement("label");
      label.textContent = (doc.document_name || doc.name) + (doc.is_mandatory ? " *" : " (اختياري)");
      label.style.display = "block";
      label.style.marginBottom = "8px";
      label.style.fontWeight = "600";
      if (doc.is_mandatory) label.style.color = "#dc2626";

      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf,.png,.jpg,.jpeg";
      input.className = "dynamic-doc-input";
      input.style.width = "100%";
      input.style.padding = "10px";
      input.style.border = "1px solid #e2e8f0";
      input.style.borderRadius = "8px";

      const reqId = doc.document_requirement_id || doc.id;
      input.setAttribute("data-req-id", reqId);
      input.setAttribute("data-mandatory", doc.is_mandatory);

      div.appendChild(label);
      div.appendChild(input);
      docsContainer.appendChild(div);
    });
  }
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
  todayDateOnly.setHours(0, 0, 0, 0);

  body.innerHTML = recent.length
    ? recent.map((r) => {
          const startDate = new Date(r.start_date);
          startDate.setHours(0,0,0,0);
          
          const isApproved = r.status === "Approved";
          const notReturned = !r.returned_at;
          const canReturn = isApproved && notReturned && (todayDateOnly >= startDate);

          let actionOrStatus = statusBadge(r.status); 

          if (canReturn) {
            actionOrStatus = `
                <div style="display:flex; align-items:center; gap:5px;">
                    ${statusBadge(r.status)}
                    <button class="btn" 
                            style="background-color: #014366; color: white; border:none; padding: 4px 8px; font-size: 11px;" 
                            onclick="submitReturnDeclaration(${r.request_id})">
                        تسجيل عودة
                    </button>
                </div>
            `;
          } else if (r.returned_at) {
             actionOrStatus = `
                <div style="display:flex; flex-direction:column; gap:2px;">
                    ${statusBadge(r.status)}
                    <span style="font-size:10px; color:green;">تمت العودة</span>
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
        }).join("")
    : `<tr><td colspan="4" class="muted">لا يوجد طلبات حديثة.</td></tr>`;
  // 3. تحديث الإحصائيات (كما هي)
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

  const setStat = (id, valId, value) => {
    const el = qs(id);
    const bar = qs(valId);
    if (el) el.textContent = value.toLocaleString("ar-EG");
    if (bar)
      bar.style.width = Math.min(100, total ? (value / total) * 100 : 0) + "%";
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
  
  // Use current date (reset time to 00:00:00 for accurate comparison)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = !q
    ? allRequests
    : allRequests.filter((r) => {
        const s = `${r.request_id} ${r.status} ${r.leaveType?.type_name || ""}`.toLowerCase();
        return s.includes(q);
      });

  body.innerHTML = filtered.length
    ? filtered.map((r) => {
          const startDate = new Date(r.start_date);
          const endDate = new Date(r.end_date);
          startDate.setHours(0,0,0,0);
          endDate.setHours(0,0,0,0);

          const isApproved = r.status === "Approved";
          const notReturned = r.returned_at === null;
          
          // Logic: Show "Return" button if Approved AND (Today >= Start Date) AND Not Returned yet
          // This allows "Early Return" (Cutting leave) and "Normal Return"
          const canReturn = isApproved && notReturned && (today >= startDate);

          let actionHtml = `<button class="btn" data-view="${r.request_id}">تفاصيل</button>`;

          if (canReturn) {
            // Determine if it is early cut or normal return
            const isEarly = today < endDate;
            const btnText = isEarly ? "✂️ قطع الإجازة" : "↩️ تسجيل عودة";
            const btnColor = isEarly ? "#d97706" : "#014366"; // Amber for cut, Blue for normal

            actionHtml = `
                <div style="display:flex; gap:5px;">
                    <button class="btn" style="background-color: ${btnColor}; color: white; padding:6px 12px;" 
                            onclick="submitReturnDeclaration(${r.request_id})">
                        ${btnText}
                    </button>
                    <button class="btn" data-view="${r.request_id}" style="padding:6px;">📄</button>
                </div>
            `;
          } else if (r.returned_at) {
            actionHtml = `
                <div style="display:flex; align-items:center; gap:5px;">
                    <span style="font-size:12px; color:green; font-weight:bold;">تمت العودة ✅</span>
                    <button class="btn" data-view="${r.request_id}" style="padding:4px 8px; font-size:12px">📄</button>
                </div>
            `;
          }

          return `
            <tr>
              <td>${r.request_id}</td>
              <td>${escapeHtml(r.leaveType?.type_name || "-")}</td>
              <td>${statusBadge(r.status)}</td>
              <td>${actionHtml}</td>
            </tr>
          `;
        }).join("")
    : `<tr><td colspan="4" class="muted">لا توجد نتائج.</td></tr>`;

  qsa("button[data-view]", body).forEach((btn) => {
    btn.addEventListener("click", () => showRequestDetails(btn.getAttribute("data-view")));
  });
}

qs("#search").addEventListener("input", renderRequestsTable);

async function showRequestDetails(requestId) {
  try {
    const res = await apiFetch(`/api/me/leave-requests/${requestId}`);
    const d = res?.data;

    const canCancel = String(d?.status || "").toLowerCase() === "pending";
    const steps = d?.approvalSteps || [];
    const attachments = d?.attachments || [];

    // Helper to format dates
    const fmt = (date) => date ? new Date(date).toISOString().split('T')[0] : "-";
    
    // --- 🟢 NEW LOGIC: Extract Approval Data for Print ---
    // Find the step where the request was Approved or Rejected
    const decisionStep = steps.find(s => s.status === 'Approved' || s.status === 'Rejected') || {};
    
    const isApproved = d.status === 'Approved';
    const isRejected = d.status === 'Rejected';
    
    // Get Manager Name & Comments if they exist
    const managerName = decisionStep.approver?.name || "";
    const managerComment = decisionStep.comments || "";
    
    // Get Employee Name (Fixing the 'undefined' bug)
    const employeeName = d?.user?.name || currentUser?.name || "موظف";
    // -----------------------------------------------------

    openModal(`
      <button onclick="closeModal()" 
              style="position: absolute; left: 20px; top: 20px; background: #f3f4f6; border: 1px solid #d1d5db; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #4b5563; font-size: 18px; transition: all 0.2s; z-index: 10;"
              onmouseover="this.style.background='#e5e7eb'; this.style.color='#1f2937';"
              onmouseout="this.style.background='#f3f4f6'; this.style.color='#4b5563';">
        <i class="fa-solid fa-xmark"></i>
      </button>

      <div class="official-doc">
        
        <div class="doc-header">
          <div class="doc-logo">
            <img src="../../Assets/شعار_جامعة_الغردقة.png" alt="University Logo" style="max-height: 80px;">
          </div>
          <div class="doc-title">
            <h2>طلب إجازة</h2>
            <span>Leave Request Form</span>
          </div>
          <div class="doc-meta" style="text-align: left; font-size: 12px; line-height: 1.6;">
             <div><b>رقم الطلب:</b> #${d?.request_id}</div>
             <div><b>تاريخ الطلب:</b> ${fmt(d?.created_at)}</div>
             <div><b>الحالة الحالية:</b> ${statusBadge(d?.status)}</div>
          </div>
        </div>

        <div class="doc-section">
          <div class="doc-row">
            <span class="doc-label">اسم الموظف:</span>
            <span class="doc-value">${escapeHtml(employeeName)}</span>
          </div>
          <div style="display: flex; gap: 20px;">
            <div class="doc-row" style="flex: 1;">
                <span class="doc-label">الوظيفة:</span>
                <span class="doc-value">${escapeHtml(d?.user?.job_title || d?.user?.role || "-")}</span>
            </div>
            <div class="doc-row" style="flex: 1;">
                <span class="doc-label">الجهة/القسم:</span>
                <span class="doc-value">${escapeHtml(d?.user?.department?.department_name || d?.user?.department || "-")}</span>
            </div>
          </div>
        </div>

        <div class="doc-section" style="margin-top: 15px;">
          <div class="doc-row">
            <span class="doc-label">نوع الإجازة:</span>
            <span class="doc-value">${escapeHtml(d?.leaveType?.type_name || "-")}</span>
          </div>
          
          <div style="display: flex; gap: 20px;">
             <div class="doc-row" style="flex: 1;">
                <span class="doc-label">من تاريخ:</span>
                <span class="doc-value">${fmt(d?.start_date)}</span>
             </div>
             <div class="doc-row" style="flex: 1;">
                <span class="doc-label">إلى تاريخ:</span>
                <span class="doc-value">${fmt(d?.end_date)}</span>
             </div>
          </div>

          <div class="doc-row">
            <span class="doc-label">المدة المطلوبة:</span>
            <span class="doc-value">${d?.duration || 0} يوم</span>
          </div>

           <div class="doc-row" style="margin-top: 10px;">
            <span class="doc-label">السبب:</span>
            <span class="doc-value">${escapeHtml(d?.reason || "-")}</span>
           </div>
        </div>

        ${attachments.length ? `
        <div style="margin-top: 15px; padding: 10px; border: 1px dashed #ccc;">
           <strong>📎 المرفقات:</strong>
           ${attachments.map(a => `<a href="${a.filePath}" target="_blank" style="color: blue; margin-right: 10px; text-decoration: underline;">${a.fileName || "ملف"}</a>`).join(" ")}
        </div>
        ` : ''}

        <div style="margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px;">
            <h4>📜 السجل الرقمي (Digital History)</h4>
            <table style="width: 100%; font-size: 12px; margin-top: 5px; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f3f4f6; text-align: right;">
                        <th style="padding: 5px;">الخطوة</th>
                        <th style="padding: 5px;">الحالة</th>
                        <th style="padding: 5px;">المعتمد</th>
                        <th style="padding: 5px;">ملاحظات</th>
                    </tr>
                </thead>
                <tbody>
                    ${steps.map(s => `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 5px;">${s.step_order || "-"}</td>
                            <td style="padding: 5px;">${statusBadge(s.status)}</td>
                            <td style="padding: 5px;">${s.approver?.name || "-"}</td>
                            <td style="padding: 5px;">${s.comments || "-"}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>

        <div class="print-only-section" style="margin-top: 30px; border: 2px solid #000; padding: 15px; page-break-inside: avoid;">
            <div style="text-align: center; font-weight: bold; text-decoration: underline; margin-bottom: 15px; font-size: 16px;">
                الاعتمادات (للاستخدام الورقي / الإداري)
            </div>
            
            <div style="display: flex; gap: 20px;">
                <div style="flex: 1; border-left: 1px solid #000; padding-left: 10px;">
                    <div style="font-weight: bold; margin-bottom: 8px;">مراجعة شؤون العاملين:</div>
                    <div style="margin-bottom: 5px;">الرصيد يسمح: [ نعم ]  [ لا ]</div>
                    <div style="margin-top: 25px; display: flex; align-items: center;">
                        <span>التوقيع:</span>
                        <div style="border-bottom: 1px dotted #000; flex: 1; margin-right: 5px;"></div>
                    </div>
                </div>

                <div style="flex: 1;">
                    <div style="font-weight: bold; margin-bottom: 8px;">اعتماد السلطة المختصة:</div>
                    
                    <div style="margin-bottom: 5px;">
                        ${isApproved ? '[ ✔ ]' : '[ &nbsp;&nbsp; ]'} موافقة
                    </div>
                    <div style="margin-bottom: 5px;">
                        ${isRejected ? '[ ✔ ]' : '[ &nbsp;&nbsp; ]'} رفض
                    </div>

                    ${managerComment ? `<div style="font-size: 11px; margin-top:5px; font-style: italic;">ملاحظات: "${escapeHtml(managerComment)}"</div>` : ''}

                    <div style="margin-top: 20px; display: flex; align-items: center;">
                        <span>التوقيع:</span>
                        <div style="border-bottom: 1px dotted #000; flex: 1; margin-right: 5px; font-family: 'Segoe Script', cursive; color: #014366; text-align:center;">
                             ${managerName}
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
                <div style="text-align: center; width: 200px;">
                    <div style="margin-bottom: 15px;">توقيع مقدم الطلب</div>
                    <div style="border-bottom: 1px dotted #000; font-family: 'Segoe Script', cursive; color: #014366;">
                        ${employeeName}
                    </div>
                </div>
            </div>
        </div>

      </div>
      <div class="modal-footer" style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px; display: flex; justify-content: space-between; align-items: center;">
         
         <div>
            ${canCancel ? `
                <button class="btn danger" id="cancelBtn" style="font-size: 14px;">
                    <i class="fa-solid fa-trash"></i> إلغاء الطلب
                </button>
            ` : ''}
         </div>

         <div style="display: flex; gap: 10px;">
            <button class="btn" onclick="window.print()" style="background-color: #4b5563; color: white; border: none; padding: 10px 20px; border-radius: 6px;">
                <i class="fa-solid fa-print"></i> طباعة الطلب
            </button>
            <button class="btn" onclick="closeModal()" style="border: 1px solid #ccc;">
                إغلاق
            </button>
         </div>
      </div>
    `);

    // Wire up Cancel Button Logic
    if (canCancel) {
      document.getElementById("cancelBtn").addEventListener("click", async () => {
        if (!confirm("هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟")) return;
        try {
          await apiFetch(`/api/me/leave-requests/${requestId}/cancel`, {
            method: "PUT",
          });
          toast("تم", "تم إلغاء الطلب بنجاح", "success");
          closeModal();
          await loadAll();
        } catch (e) {
          toast("خطأ", e.message, "error");
        }
      });
    }

  } catch (e) {
    toast("خطأ", e.message, "error");
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
      if (dropName) dropName.textContent = user.name;
      if (dropRole) dropRole.textContent = translateRole(user.role);

      // 3. 🚀 CHECK ROLE FOR SWITCH BUTTON
      const switchBtn = qs("#switchRoleBtn");
      // Roles allowed to see the Manager Portal
      const managerRoles = [
        "Manager",
        "Dean",
        "Head_of_Department",
        
      ];
      const adminRoles = ["HR_Admin"];
      if (switchBtn) {
  // A. Case: User is an ADMIN
  if (adminRoles.includes(user.role)) {
    switchBtn.style.display = "flex";
    switchBtn.href = "../Admin/hr.html"; 
    
    // Update the text to say "Admin Portal"
    const textSpan = switchBtn.querySelector("span");
    if (textSpan) textSpan.textContent = "التبديل إلى لوحة المسؤول";
  } 
  // B. Case: User is a MANAGER
  else if (managerRoles.includes(user.role)) {
    switchBtn.style.display = "flex";
    switchBtn.href = "../manager/manager.html"; 
    
    // Update the text to say "Manager Portal"
    const textSpan = switchBtn.querySelector("span");
    if (textSpan) textSpan.textContent = "التبديل إلى بوابة المدير";
  } 
  // C. Case: User is a regular EMPLOYEE
  else {
    switchBtn.style.display = "none"; // Hide the button
  }
      }

      // 4. Setup Dropdown Toggle
      const userInfoEl = qs("#userInfo");
      const dropdown = qs("#profileDropdown");

      if (userInfoEl && dropdown) {
        userInfoEl.onclick = (e) => {
          if (!e.target.closest(".dropdown-item")) {
            e.stopPropagation();
            dropdown.classList.toggle("active");
          }
        };

        document.addEventListener("click", (e) => {
          if (!dropdown.contains(e.target) && !userInfoEl.contains(e.target)) {
            dropdown.classList.remove("active");
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

// Variable to cache delegates
let delegatesList = [];

async function loadDelegates() {
  console.log("🚀 loadDelegates function started...");

  // Remove this line temporarily so we can retry fetching if it failed before
  // if (delegatesList.length > 0) return;

  const sel = document.getElementById("delegateSelect");
  if (!sel) {
    console.error(
      "❌ Error: Could not find <select id='delegateSelect'> in the HTML."
    );
    return;
  }

  // Show loading state
  sel.innerHTML = '<option value="">⏳ جاري التحميل...</option>';

  try {
    console.log("📡 Sending request to: /api/employee/users");

    // Make the API Call
    const res = await apiFetch("/api/me/users");

    console.log("📥 API Response received:", res);

    // Extract Data
    delegatesList = res.data || [];
    console.log("🔢 Number of delegates found:", delegatesList.length);

    // Check if list is empty
    if (delegatesList.length === 0) {
      console.warn(
        "⚠️ The backend returned 0 users. Check if you have other active users in the SAME department."
      );
      sel.innerHTML =
        '<option value="">🚫 لا يوجد زملاء متاحين في القسم</option>';
      return;
    }

    // Render Options
    const optionsHtml = delegatesList
      .map((u) => {
        // Ensure we use the correct ID field
        const id = u.user_id || u.id;
        const label = u.job_title ? `${u.name} (${u.job_title})` : u.name;
        return `<option value="${id}">${label}</option>`;
      })
      .join("");

    sel.innerHTML = '<option value="">-- اختر زميل --</option>' + optionsHtml;
    console.log("✅ Dropdown successfully populated.");
  } catch (e) {
    console.error("❌ Failed to load delegates. Error details:", e);
    sel.innerHTML = '<option value="">⚠️ خطأ في تحميل القائمة</option>';

    // Optional: Alert specifically for 404
    if (e.message && e.message.includes("404")) {
      console.error(
        "👉 CAUSE: The route '/api/employee/users' does not exist on the server."
      );
    }
  }
}
// Add this helper if not already in employee.js
function translateRole(role) {
  const map = {
    Manager: "مدير",
    Dean: "عميد الكلية",
    Head_of_Department: "رئيس القسم",
    HR_Admin: "الموارد البشرية",
    Employee: "موظف",
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
    toast("تحميل", "جاري جلب بيانات الموظف...", "warn");
    loadNotifications();
    fetchUnreadCount();
    await Promise.all([
      loadProfile(),
      loadDashboard(),
      loadEligibleTypes(),
      loadRequests(),
    ]);
    toast("تمام", "اتحدثت البيانات بنجاح", "success");
  } catch (e) {
    toast("خطأ", e.message, "error");
  }
}

qs("#submitBtn").addEventListener("click", async () => {
  try {
    const submitBtn = qs("#submitBtn");

    // 1. Basic Data
    const type_id = Number(qs("#typeSelect").value);
    const start_date = qs("#startDate").value;
    const end_date = qs("#endDate").value;
    const reason = qs("#reason").value.trim();
    const ackCheckbox = qs("#acknowledgementCheckbox");

    // 2. Basic Validation
    if (!type_id || !start_date || !end_date || !reason) {
      toast("ناقص بيانات", "من فضلك املأ النوع + التواريخ + السبب", "warn");
      return;
    }

    if (!ackCheckbox || !ackCheckbox.checked) {
      toast("تنبيه", "⚠️ يجب الموافقة على الإقرار.", "warn");
      return;
    }

    // 3. Delegate Validation
    const delegateWrap = qs("#delegateWrapper");
    const delegateSelect = qs("#delegateSelect");
    let delegateId = null;

    // If delegate wrapper is visible, validation is required
    if (delegateWrap && delegateWrap.style.display !== "none") {
      if (!delegateSelect.value) {
        toast("تنبيه", "هذا النوع من الإجازة يتطلب تحديد موظف مفوض.", "warn");
        return;
      }
      delegateId = delegateSelect.value;
    }

    // 4. Collect & Validate Dynamic Documents
    const fd = new FormData();
    const docInputs = document.querySelectorAll(".dynamic-doc-input");

    for (const input of docInputs) {
      const reqId = input.getAttribute("data-req-id");
      const isMandatory = input.getAttribute("data-mandatory") === "true";
      const file = input.files[0];

      if (isMandatory && !file) {
        toast("مستند ناقص", "يرجى إرفاق جميع المستندات المطلوبة.", "error");
        return;
      }

      if (file) {
        // ✅ Map to backend format: doc_{id}
        fd.append(`doc_${reqId}`, file);
      }
    }

    // 5. Append Standard Fields
    fd.append("type_id", String(type_id));
    fd.append("start_date", start_date);
    fd.append("end_date", end_date);
    fd.append("reason", reason);
    fd.append("pre_leave_acknowledgement", "true");

    if (delegateId) {
      fd.append("delegate_user_id", delegateId);
    }

    // 6. Submit
    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.textContent = "جاري الإرسال...";

    await apiFetch(`/api/me/leave-requests`, {
      method: "POST",
      body: fd,
      isForm: true,
    });

    toast("تم الإرسال", "تم إنشاء الطلب بنجاح", "success");

    // Reset Form
    qs("#reason").value = "";
    qs("#dynamicDocsContainer").innerHTML = "";
    ackCheckbox.checked = false;
    qs("#typeSelect").dispatchEvent(new Event("change")); // Reset dynamic UI

    await loadAll();
    switchTab("history");
  } catch (e) {
    toast("خطأ", e.message, "error");
  } finally {
    const submitBtn = qs("#submitBtn");
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-left: 8px">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
        </svg> إرسال الطلب`;
  }
});

// 2. Fetch The List (The 20 most recent)
async function loadNotifications() {
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


// 3. Fetch Unread Count (Universal Fix)
async function fetchUnreadCount() {
  const badge = document.querySelector(".badge-count");

  // 1. Safety Check: Does the HTML element exist?
  if (!badge) return;

  try {
    const res = await apiFetch("/api/notifications/unread-count");
    
    // Debug to see exactly what arrives
    console.log("📩 Unread Count Response:", res);

    let finalCount = 0;

    // --- LOGIC TO HANDLE ALL FORMATS ---
    
    // Case A: Backend sends { data: 5 } (Raw Number)
    if (typeof res.data === 'number') {
      finalCount = res.data;
    }
    // Case B: Backend sends { count: 5 } (Top level key)
    else if (typeof res.count === 'number') {
        finalCount = res.count;
    }
    // Case C: Backend sends { data: { unreadCount: 5 } } or { data: { count: 5 } }
    else if (res.data && typeof res.data === 'object') {
      // Check all possible naming conventions
      finalCount = res.data.unreadCount || res.data.count || res.data.unread || 0;
    }

    // --- UPDATE UI ---
    if (finalCount > 0) {
      badge.style.display = "flex"; 
      badge.textContent = finalCount > 99 ? "99+" : finalCount;
      badge.classList.add('pulse-animation');
    } else {
      badge.style.display = "none";
    }

  } catch (e) {
    console.error("❌ Failed to load unread count", e);
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
    toast("خطأ", "تعذر تحديث حالة الإشعار", "error");
  }
}

// 5. Mark All Read
const markAllBtn = document.getElementById("markAllBtn");
if (markAllBtn) {
  markAllBtn.addEventListener("click", async () => {
    try {
      // Calls: PATCH /api/notifications/mark-all-read
      await apiFetch(`/api/notifications/mark-all-read`, { method: "PATCH" });

      toast("تم", "تم تحديد الكل كمقروء", "success");
      loadNotifications(); // Refresh UI
    } catch (e) {
      toast("خطأ", "حدث خطأ أثناء التحديث", "error");
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

// ✅ NEW: Function to handle "Return to Work"
// دالة عرض نافذة تأكيد العودة للعمل (بشكل احترافي)
function submitReturnDeclaration(requestId) {
  // 1. فتح المودال بتصميم الإقرار
  openModal(`
    <div class="modal-header" style="background: linear-gradient(135deg, #014366 0%, #0F93B4 100%);">
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
        <p style="font-size: 16px; line-height: 1.6; color: #014366; font-weight: 600; margin: 0;">
          "أقر بأنني استأنفت أعمالي المصلحية في الكلية/الجامعة عقب انتهاء الإجازة المرخص لي بها، وذلك اعتباراً من تاريخ اليوم."
        </p>
      </div>

      <div class="actions" style="justify-content: center; gap: 16px;">
        <button id="confirmReturnBtn" class="btn primary" style="background-color: #014366; font-size: 16px; padding: 12px 32px;">
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
            method: "POST",
          });

          toast("تم بنجاح", "تم تسجيل إقرار العودة للعمل.", "success");
          closeModal();
          await loadRequests(); // تحديث الجدول لإخفاء الزر

          // تحديث لوحة التحكم أيضاً إذا كنا فيها
          if (
            document
              .getElementById("view-dashboard")
              .classList.contains("active")
          ) {
            loadDashboard();
          }
        } catch (e) {
          toast("خطأ", e.message, "error");
          confirmBtn.textContent = "تأكيد العودة";
          confirmBtn.disabled = false;
        }
      });
    }
  }, 50);
}
// auto-load
loadAll();
