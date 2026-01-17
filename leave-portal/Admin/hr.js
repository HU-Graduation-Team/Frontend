/* =========================
   بوابة الإدارة (الموارد البشرية/الإدارة)
   ========================= */

(function () {
  const $ = window.qs || ((sel, root = document) => root.querySelector(sel));
  const $$ =
    window.qsa ||
    ((sel, root = document) => Array.from(root.querySelectorAll(sel)));
  const toast =
    window.showToast || window.toast || ((t, m) => alert(`${t}\n${m || ""}`));

  const apiFetch = window.apiFetch;
  const getToken = window.getToken;
  const setToken = window.setToken;
  const clearToken = window.clearToken;
  const openModal = window.openModal;
  const closeModal = window.closeModal;
  const wireModalClose = window.wireModalClose;

  if (!apiFetch || !getToken || !setToken || !clearToken || !openModal) {
    console.warn(
      "[hr.js] تأكد من تحميل common.js قبل hr.js لأن بعض الدوال المطلوبة غير موجودة."
    );
  }

  // ---------- قاموس التعريب (للعرض فقط) ----------
  const AR = {
    roles: {
      Admin: "مسؤول النظام",
      Manager: "مدير",
      Dean: "عميد",
      Head_of_Department: "رئيس قسم",
      Employee: "موظف",
      HR_Admin: "مسؤول الموارد البشرية",
      HRAdmin: "مسؤول الموارد البشرية",
      HR: "مسؤول الموارد البشرية",
    },
    userTypes: {
      Academic: "أكاديمي",
      Administrative: "إداري",
      All: "الكل",
    },
    statuses: {
      Pending: "قيد المراجعة",
      Approved: "موافق عليه",
      Rejected: "مرفوض",
      Cancelled: "ملغي",
      Canceled: "ملغي",
    },
    categories: {
      Paid: "مدفوعة",
      Unpaid: "غير مدفوعة",
    },
    balanceTypes: {
      fixed: "ثابت",
      calculated: "محسوب",
    },
    genders: {
      All: "الكل",
      Male: "ذكر",
      Female: "أنثى",
    },
  };

  function mapCI(map, value, fallback = "—") {
    const v = String(value ?? "").trim();
    if (!v) return fallback;
    const key = Object.keys(map).find(
      (k) => k.toLowerCase() === v.toLowerCase()
    );
    return key ? map[key] : v;
  }

  const arRole = (v) => mapCI(AR.roles, v, "—");
  const arUserType = (v) => mapCI(AR.userTypes, v, "—");
  const arStatus = (v) => mapCI(AR.statuses, v, String(v || "—"));
  const arCategory = (v) => mapCI(AR.categories, v, String(v || "—"));
  const arBalanceType = (v) => mapCI(AR.balanceTypes, v, String(v || "—"));
  const arGender = (v) => mapCI(AR.genders, v, String(v || "—"));

  // ---------- State ----------
  const state = {
    me: null,
    users: [],
    departments: [],
    colleges: [],
    leaveTypes: [],
    eligibility: [],
    notifications: [],
    report: {
      items: [],
      page: 1,
      limit: 25,
      total: 0,
      hasNext: false,
      lastFilters: {},
    },
  };

  // ---------- UI Helpers ----------
  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function unwrap(res) {
    return res?.data ?? res;
  }

  function getId(obj) {
    return (
      obj?.id ??
      obj?.user_id ??
      obj?.department_id ??
      obj?.college_id ??
      obj?.leave_type_id ??
      obj?.rule_id ??
      obj?.request_id ??
      obj?._id
    );
  }

  function roleLooksAdmin(role) {
    const r = String(role || "").toLowerCase();
    return (
      r.includes("admin") ||
      r === "hr_admin" ||
      r === "super_admin" ||
      r === "system_admin"
    );
  }

  function setLoading(isLoading, text) {
    const ov = $("#loadingOverlay");
    if (!ov) return;
    if (text) {
      const t = ov.querySelector(".loading-text");
      if (t) t.textContent = text;
    }
    ov.style.display = isLoading ? "flex" : "none";
  }

  function timeAgo(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);

    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "الآن";
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `منذ ${diffHr} ساعة`;

    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `منذ ${diffDay} يوم`;

    return d.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  function setBadge(count) {
    const badge = $("#notifBadge");
    if (!badge) return;
    const n = Number(count) || 0;
    if (n <= 0) {
      badge.style.display = "none";
      badge.textContent = "0";
      return;
    }
    badge.style.display = "inline-flex";
    badge.textContent = String(n);
  }

  function setPendingBadge(count) {
    const b = $("#pendingBadge");
    if (!b) return;
    b.textContent = String(Number(count) || 0);
  }

  function openFancyModal({ title, subtitle, iconHtml, bodyHtml, footerHtml }) {
    openModal(`
      <div class="modal-header">
        <div class="modal-title">
          <div class="modal-icon">
            ${iconHtml || '<i class="fa-solid fa-circle-info"></i>'}
          </div>
          <div>
            <h2>${esc(title || "")}</h2>
            ${
              subtitle
                ? `<div class="modal-subtitle">${esc(subtitle)}</div>`
                : ""
            }
          </div>
        </div>

        <button type="button" class="modal-close-btn" aria-label="إغلاق" onclick="closeModal()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="modal-body">
        ${bodyHtml || ""}
      </div>

      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ""}
    `);
  }

  function confirmModal(title, message, onYes) {
    openFancyModal({
      title,
      subtitle: message,
      iconHtml: `<i class="fa-solid fa-triangle-exclamation"></i>`,
      bodyHtml: `
        <div class="row" style="gap:10px; justify-content:flex-end; flex-wrap:wrap">
          <button class="btn" id="cmNo">إلغاء</button>
          <button class="btn danger" id="cmYes">تأكيد</button>
        </div>
      `,
    });

    $("#cmNo")?.addEventListener("click", () => closeModal());
    $("#cmYes")?.addEventListener("click", async () => {
      try {
        setLoading(true, "جاري التنفيذ...");
        await onYes?.();
        closeModal();
      } catch (e) {
        toast("خطأ", e?.message || "حدث خطأ", "error");
      } finally {
        setLoading(false);
      }
    });
  }

  function buildQuery(params) {
    const usp = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      usp.set(k, String(v));
    });
    const s = usp.toString();
    return s ? `?${s}` : "";
  }

  function parseListResponse(res) {
    const data = unwrap(res);

    if (Array.isArray(data)) {
      return { items: data, total: undefined };
    }

    const items =
      data?.items ||
      data?.requests ||
      data?.data ||
      data?.notifications ||
      data?.users ||
      data?.departments ||
      data?.colleges ||
      data?.leave_types ||
      data?.leaveTypes ||
      [];

    const total =
      data?.total ??
      data?.count ??
      data?.totalCount ??
      data?.pagination?.total ??
      data?.meta?.total;

    return { items: Array.isArray(items) ? items : [], total };
  }

  function pickUserName(u) {
    return u?.name || u?.full_name || u?.fullName || "—";
  }

  function pickUserType(u) {
    return u?.type || u?.user_type || u?.userType || "—";
  }

  function pickDeptName(u) {
    return (
      u?.department_name ||
      u?.department?.department_name ||
      u?.department?.name ||
      u?.departmentName ||
      u?.department_id ||
      "—"
    );
  }

  function pickCollegeName(u) {
    return (
      u?.college_name ||
      u?.college?.college_name ||
      u?.college?.name ||
      u?.collegeName ||
      u?.college_id ||
      "—"
    );
  }

  function isUserActive(u) {
    if (u?.is_active !== undefined) return Boolean(u.is_active);
    if (u?.active !== undefined) return Boolean(u.active);
    if (u?.status) return String(u.status).toLowerCase() !== "inactive";
    return true;
  }

  function getDeep(obj, paths, fallback = "") {
    for (const p of paths) {
      try {
        const parts = p.split(".");
        let cur = obj;
        for (const k of parts) cur = cur?.[k];
        if (cur !== undefined && cur !== null && cur !== "") return cur;
      } catch (_) {}
    }
    return fallback;
  }

  function formatDateTimeAr(v) {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function statusMeta(status) {
    const s = String(status || "").toLowerCase();
    if (s.includes("pending"))
      return { cls: "pending", icon: "⏳", text: arStatus("Pending") };
    if (s.includes("approve"))
      return { cls: "approved", icon: "✅", text: arStatus("Approved") };
    if (s.includes("reject"))
      return { cls: "rejected", icon: "❌", text: arStatus("Rejected") };
    if (s.includes("cancel"))
      return { cls: "cancelled", icon: "🚫", text: arStatus("Cancelled") };
    return { cls: "", icon: "ℹ️", text: arStatus(status || "—") };
  }

  function calcDurationDays(from, to) {
    const a = new Date(from);
    const b = new Date(to);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "—";
    const diff = Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? `${diff} يوم` : "—";
  }

  function openRequestDetailsModal(req, requestId) {
    const id = requestId || getId(req) || "—";

    const employeeName = getDeep(
      req,
      [
        "employee_name",
        "employee.name",
        "employee.full_name",
        "user.name",
        "user.full_name",
        "user_name",
      ],
      "—"
    );

    const employeeId = getDeep(
      req,
      ["employee_id", "user_id", "employee.id", "user.id"],
      "—"
    );

    const leaveType = getDeep(
      req,
      [
        "leave_type_name",
        "leave_type.type_name",
        "leaveType.type_name",
        "leave_type.name",
        "leaveType.name",
      ],
      "—"
    );

    const from = getDeep(req, ["start_date", "from", "startDate"], "—");
    const to = getDeep(req, ["end_date", "to", "endDate"], "—");
    const status = getDeep(req, ["status", "current_status"], "—");
    const createdAt = getDeep(req, ["created_at", "createdAt", "created"], "");
    const reason = getDeep(
      req,
      ["reason", "comment", "notes", "description"],
      "—"
    );

    const duration =
      from !== "—" && to !== "—" ? calcDurationDays(from, to) : "—";
    const st = statusMeta(status);

    const rawJson = JSON.stringify(req || {}, null, 2);

    openFancyModal({
      title: `تفاصيل الطلب رقم ${esc(id)}`,
      subtitle: createdAt
        ? `تاريخ الإنشاء: ${esc(formatDateTimeAr(createdAt))}`
        : "تفاصيل الطلب",
      iconHtml: `<i class="fa-solid fa-file-lines"></i>`,
      bodyHtml: `
      <div class="details-wrap">
        <div class="details-kpis">
          <div class="kpi-card">
            <div class="kpi-title"><i class="fa-solid fa-user"></i> الموظف</div>
            <div class="kpi-value">${esc(employeeName)}</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-title"><i class="fa-solid fa-list-check"></i> نوع الإجازة</div>
            <div class="kpi-value">${esc(leaveType)}</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-title"><i class="fa-regular fa-calendar"></i> المدة</div>
            <div class="kpi-value">${esc(duration)}</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-title"><i class="fa-solid fa-circle-info"></i> الحالة</div>
            <div class="kpi-value big">
              <span class="status-chip ${st.cls}">
                <span>${st.icon}</span>
                <span>${esc(st.text)}</span>
              </span>
            </div>
          </div>
        </div>

        <div class="details-grid">
          <div class="detail-item">
            <div class="detail-label"><i class="fa-solid fa-hashtag"></i> رقم الطلب</div>
            <div class="detail-value ltr">${esc(id)}</div>
          </div>

          <div class="detail-item">
            <div class="detail-label"><i class="fa-solid fa-id-badge"></i> رقم الموظف</div>
            <div class="detail-value ltr">${esc(employeeId)}</div>
          </div>

          <div class="detail-item">
            <div class="detail-label"><i class="fa-regular fa-calendar-days"></i> من</div>
            <div class="detail-value ltr">${esc(from)}</div>
          </div>

          <div class="detail-item">
            <div class="detail-label"><i class="fa-regular fa-calendar-days"></i> إلى</div>
            <div class="detail-value ltr">${esc(to)}</div>
          </div>

          <div class="detail-item" style="grid-column: 1 / -1;">
            <div class="detail-label"><i class="fa-solid fa-comment-dots"></i> السبب / الملاحظات</div>
            <div class="detail-value">${esc(reason || "—")}</div>
          </div>
        </div>

        <div class="details-actions">
          <button class="btn" id="toggleRawJson">
            <i class="fa-solid fa-code"></i> عرض البيانات الخام
          </button>
          <button class="btn" id="copyRawJson">
            <i class="fa-regular fa-copy"></i> نسخ البيانات
          </button>
        </div>

        <div class="raw-json-panel" id="rawJsonPanel">
          <pre>${esc(rawJson)}</pre>
        </div>
      </div>
    `,
      footerHtml: `<button class="btn" onclick="closeModal()">إغلاق</button>`,
    });

    $("#toggleRawJson")?.addEventListener("click", () => {
      const panel = $("#rawJsonPanel");
      if (!panel) return;
      const isOpen = panel.style.display === "block";
      panel.style.display = isOpen ? "none" : "block";
      $("#toggleRawJson").innerHTML = isOpen
        ? `<i class="fa-solid fa-code"></i> عرض البيانات الخام`
        : `<i class="fa-solid fa-code"></i> إخفاء البيانات الخام`;
    });

    $("#copyRawJson")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(rawJson);
        toast("تم", "تم النسخ", "success");
      } catch (_) {
        toast("تنبيه", "تعذر النسخ تلقائياً — انسخ يدوياً", "warn");
      }
    });
  }

  // ---------- Tabs ----------
  function initTabs() {
    $$(".nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        $$(".nav-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        $$(".section-view").forEach((v) => v.classList.remove("active"));
        $(`#view-${tab}`)?.classList.add("active");

        onTabChanged(tab);
      });
    });
  }

  async function onTabChanged(tab) {
    if (!getToken()) return;

    try {
      if (tab === "dashboard") await loadDashboard();
      if (tab === "users") await loadUsers();
      if (tab === "org") await Promise.all([loadColleges(), loadDepartments()]);
      if (tab === "leaveTypes") await loadLeaveTypes();
      if (tab === "eligibility") await loadEligibility();
      if (tab === "reports") await loadReports({ reset: true });
    } catch (e) {
      toast("خطأ", e?.message || "فشل تحميل البيانات", "error");
    }
  }

  // ---------- Header: Profile ----------
  function initUserMenu() {
    const userInfo = $("#userInfo");
    const dropdown = $("#profileDropdown");
    if (!userInfo || !dropdown) return;

    function closeAll() {
      dropdown.classList.remove("active");
      userInfo.classList.remove("open");
    }

    userInfo.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = !dropdown.classList.contains("active");
      closeAll();
      if (willOpen) {
        dropdown.classList.add("active");
        userInfo.classList.add("open");
      }
    });

    document.addEventListener("click", (e) => {
      if (dropdown.contains(e.target) || userInfo.contains(e.target)) return;
      dropdown.classList.remove("active");
      userInfo.classList.remove("open");
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll();
    });

    window.showUserProfile = () => {
      dropdown.classList.remove("active");
      userInfo.classList.remove("open");
      showProfileModal();
    };

    $("#logoutBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      clearToken();
      state.me = null;
      toast("تم", "تم تسجيل الخروج", "success");
      closeAll();
      renderProfile(null);
      setBadge(0);
      setPendingBadge(0);
    });

    $("#changePassBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      dropdown.classList.remove("active");
      userInfo.classList.remove("open");
      showChangePasswordModal();
    });

    $("#switchToEmployeePortal")?.addEventListener("click", (e) => {
      e.preventDefault();
      dropdown.classList.remove("active");
      window.location.href = "../employee/employee.html";
    });
  }

  function renderProfile(me) {
    const avatar = $("#userAvatar");
    const name = $("#userName");
    const meta = $("#userDepartment");
    const dropName = $("#dropName");
    const dropRole = $("#dropRole");

    if (!me) {
      if (avatar) avatar.textContent = "؟";
      if (name) name.textContent = "غير مسجل";
      if (meta) meta.textContent = "—";
      if (dropName) dropName.textContent = "—";
      if (dropRole) dropRole.textContent = "—";
      return;
    }

    const fullName = me.name || me.full_name || me.fullName || "—";
    const roleRaw = me.role || me.user_role || "—";
    const role = arRole(roleRaw);
    const email = me.email || "";

    const deptName =
      me.department_name ||
      me.departmentName ||
      me.department?.name ||
      me.department?.department_name ||
      "";

    const collegeName =
      me.college_name ||
      me.collegeName ||
      me.college?.name ||
      me.college?.college_name ||
      "";

    if (avatar) avatar.textContent = fullName[0] || "؟";
    if (name) name.textContent = fullName;

    if (meta) {
      const line = [role, deptName, collegeName].filter(Boolean).join(" • ");
      meta.textContent = line || role;
    }
    if (dropName) dropName.textContent = fullName;
    if (dropRole)
      dropRole.textContent = [role, email].filter(Boolean).join(" • ");
  }

  function showProfileModal() {
    const me = state.me;
    if (!me) return toast("تنبيه", "لا يوجد مستخدم مسجل", "warn");

    const fullName = me.name || me.full_name || me.fullName || "—";
    const roleRaw = me.role || me.user_role || "—";
    const role = arRole(roleRaw);
    const email = me.email || "";
    const typeRaw = me.type || me.user_type || me.userType || "";
    const type = arUserType(typeRaw);

    const active =
      me.is_active ??
      me.isActive ??
      (me.status ? String(me.status).toLowerCase() !== "inactive" : true);

    const deptName =
      me.department_name ||
      me.departmentName ||
      me.department?.name ||
      me.department?.department_name ||
      "—";

    const collegeName =
      me.college_name ||
      me.collegeName ||
      me.college?.name ||
      me.college?.college_name ||
      "—";

    openFancyModal({
      title: "الملف الشخصي",
      subtitle: "بيانات حساب الإدارة",
      iconHtml: `<i class="fa-regular fa-user"></i>`,
      bodyHtml: `
        <div class="profile-header">
          <div class="profile-avatar">${esc(fullName[0] || "؟")}</div>
          <div class="profile-header-info">
            <h4>${esc(fullName)}</h4>
            <p>${esc([role, email].filter(Boolean).join(" • "))}</p>
          </div>
        </div>

        <div class="profile-grid">
          <div class="profile-item">
            <div class="profile-label"><i class="fa-solid fa-user-shield"></i> الدور</div>
            <div class="profile-value">${esc(role)}</div>
          </div>

          <div class="profile-item">
            <div class="profile-label"><i class="fa-solid fa-envelope"></i> البريد</div>
            <div class="profile-value">${esc(email || "—")}</div>
          </div>

          <div class="profile-item">
            <div class="profile-label"><i class="fa-solid fa-id-badge"></i> نوع المستخدم</div>
            <div class="profile-value">${esc(type || "—")}</div>
          </div>

          <div class="profile-item">
            <div class="profile-label"><i class="fa-solid fa-building"></i> القسم</div>
            <div class="profile-value">${esc(deptName || "—")}</div>
          </div>

          <div class="profile-item">
            <div class="profile-label"><i class="fa-solid fa-building-columns"></i> الكلية</div>
            <div class="profile-value">${esc(collegeName || "—")}</div>
          </div>

          <div class="profile-item">
            <div class="profile-label"><i class="fa-solid fa-circle-check"></i> الحالة</div>
            <div class="profile-value">${
              active
                ? `<span class="badge good">✅ نشط</span>`
                : `<span class="badge bad">⛔ غير نشط</span>`
            }</div>
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn" onclick="closeModal()">إغلاق</button>
        <button class="btn primary" id="profChangePass">تغيير كلمة المرور</button>
      `,
    });

    $("#profChangePass")?.addEventListener("click", () => {
      closeModal();
      showChangePasswordModal();
    });
  }

  function showChangePasswordModal() {
    openFancyModal({
      title: "تغيير كلمة المرور",
      subtitle: "تأكد من إدخال كلمة مرور قوية",
      iconHtml: `<i class="fa-solid fa-key"></i>`,
      bodyHtml: `
        <div class="form-grid">
          <div>
            <label class="muted">كلمة المرور الحالية</label>
            <input class="input" id="cpOld" type="password" placeholder="••••••••" />
          </div>
          <div>
            <label class="muted">كلمة المرور الجديدة</label>
            <input class="input" id="cpNew" type="password" placeholder="••••••••" />
          </div>
          <div>
            <label class="muted">تأكيد كلمة المرور الجديدة</label>
            <input class="input" id="cpConfirm" type="password" placeholder="••••••••" />
          </div>
        </div>
        <div class="muted" style="margin-top:10px; font-size: 13px">
          نصيحة: استخدم 8 أحرف على الأقل + أرقام + رمز.
        </div>
      `,
      footerHtml: `
        <button class="btn" onclick="closeModal()">إلغاء</button>
        <button class="btn primary" id="cpSave">حفظ</button>
      `,
    });

    $("#cpSave")?.addEventListener("click", async () => {
      const oldPassword = $("#cpOld")?.value?.trim();
      const newPassword = $("#cpNew")?.value?.trim();
      const confirm = $("#cpConfirm")?.value?.trim();

      if (!oldPassword || !newPassword || !confirm)
        return toast("تنبيه", "أدخل البيانات كاملة", "warn");
      if (newPassword !== confirm)
        return toast("تنبيه", "كلمة المرور الجديدة غير متطابقة", "warn");

      try {
        setLoading(true, "جاري تغيير كلمة المرور...");
        await apiFetch("/api/profile/change-password", {
          method: "PUT",
          body: {
            old_password: oldPassword,
            new_password: newPassword,
            oldPassword,
            newPassword,
          },
        });
        toast("تم", "تم تغيير كلمة المرور", "success");
        closeModal();
      } catch (e) {
        toast("خطأ", e?.message || "فشل تغيير كلمة المرور", "error");
      } finally {
        setLoading(false);
      }
    });
  }

  // ---------- Settings ----------
  function initSettings() {
    const baseInput = $("#apiBase");
    const tokenInput = $("#token");

    if (baseInput) baseInput.value = CONFIG?.API_BASE || "";
    if (tokenInput) tokenInput.value = getToken?.() || "";

    $("#saveBtn")?.addEventListener("click", async () => {
      const base = baseInput?.value?.trim();
      const tok = tokenInput?.value?.trim();

      if (base) CONFIG.API_BASE = base.replace(/\/$/, "");
      if (tok != null) setToken(tok);

      toast("تم", "تم حفظ الإعدادات", "success");
      await bootAfterToken();
    });

    $("#clearBtn")?.addEventListener("click", () => {
      clearToken();
      if (tokenInput) tokenInput.value = "";
      toast("تم", "تم مسح التوكن", "success");
      state.me = null;
      renderProfile(null);
      setBadge(0);
      setPendingBadge(0);
    });

    $("#loginOpenBtn")?.addEventListener("click", () => showLoginModal());
  }

  function showLoginModal() {
    openFancyModal({
      title: "تسجيل الدخول",
      subtitle: "أدخل بيانات حساب الإدارة",
      iconHtml: `<i class="fa-solid fa-right-to-bracket"></i>`,
      bodyHtml: `
        <div class="form-grid">
          <div>
            <label class="muted">البريد الإلكتروني</label>
            <input class="input" id="lgEmail" placeholder="أدخل البريد الإلكتروني" />
          </div>
          <div>
            <label class="muted">كلمة المرور</label>
            <input class="input" id="lgPass" type="password" placeholder="••••••••" />
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn" onclick="closeModal()">إلغاء</button>
        <button class="btn primary" id="lgGo">دخول</button>
      `,
    });

    $("#lgGo")?.addEventListener("click", async () => {
      const email = $("#lgEmail")?.value?.trim();
      const password = $("#lgPass")?.value?.trim();
      if (!email || !password)
        return toast("تنبيه", "أدخل البريد وكلمة المرور", "warn");

      try {
        setLoading(true, "جاري تسجيل الدخول...");
        const res = await apiFetch("/api/auth/login", {
          method: "POST",
          body: { email, password },
        });

        const data = unwrap(res) || {};
        const token =
          data.token ||
          data.access_token ||
          data.accessToken ||
          data?.data?.token ||
          data?.data?.access_token;

        if (!token) throw new Error("لم يتم استلام رمز الدخول من الخادم");

        setToken(token);
        const tokenInput = $("#token");
        if (tokenInput) tokenInput.value = token;

        toast("تم", "تم تسجيل الدخول", "success");
        closeModal();

        await bootAfterToken();
      } catch (e) {
        toast("خطأ", e?.message || "فشل تسجيل الدخول", "error");
      } finally {
        setLoading(false);
      }
    });
  }

  // ---------- Profile ----------
  async function loadProfile() {
    let me = null;

    try {
      const res = await apiFetch("/api/profile");
      me = unwrap(res);
    } catch (_) {}

    if (!me) {
      try {
        const res2 = await apiFetch("/api/auth/me");
        me = unwrap(res2);
      } catch (_) {}
    }

    if (!me) throw new Error("لا يمكن تحميل بيانات الحساب");

    me = me.user || me.data?.user || me;

    const role = me.role || me.user_role;
    if (!roleLooksAdmin(role)) {
      throw new Error("هذا الحساب غير مخصص للإدارة");
    }

    state.me = me;
    renderProfile(me);
  }

  // ---------- Dashboard ----------
  async function fetchRequestsCountByStatus(status) {
    const statusVal = status ? String(status) : "";
    const attempts = [
      `/api/admin/leave-requests${buildQuery({
        status: statusVal,
        limit: 1,
        offset: 0,
      })}`,
      `/api/admin/leave-requests${buildQuery({
        status: statusVal,
        page: 1,
        pageSize: 1,
      })}`,
      `/api/admin/leave-requests${buildQuery({
        status: statusVal,
        pageNumber: 1,
        pageSize: 1,
      })}`,
    ];

    let lastErr;
    for (const path of attempts) {
      try {
        const res = await apiFetch(path);
        const { items, total } = parseListResponse(res);
        if (total !== undefined && total !== null) return Number(total) || 0;
        if (Array.isArray(items)) return items.length;
        return 0;
      } catch (e) {
        lastErr = e;
        continue;
      }
    }
    return 0;
  }

  function renderDashboardBarsSkeleton() {
    const wrap = $("#dashBars");
    if (!wrap) return;

    wrap.innerHTML = `
    <div class="dash-top">
      <div class="dash-total is-skeleton">
        <div class="sk-line w-40"></div>
        <div class="sk-big w-30"></div>
        <div class="sk-line w-60"></div>
      </div>
      <div class="dash-actions is-skeleton" style="min-width:220px; padding:16px; border-radius:18px; border:1px solid var(--border); background: var(--panel-strong);">
        <div class="sk-line w-80"></div>
        <div class="sk-line w-60"></div>
      </div>
    </div>

    <div class="status-grid">
      ${Array.from({ length: 4 })
        .map(
          () => `
        <div class="status-tile is-skeleton" style="cursor:default">
          <div class="sk-line w-40"></div>
          <div class="sk-line w-60"></div>
          <div class="sk-big w-30"></div>
          <div class="sk-line w-80"></div>
        </div>
      `
        )
        .join("")}
    </div>

    <div class="dash-stacked is-skeleton"></div>
    <div class="dash-legend is-skeleton" style="padding:8px 0">
      <div class="sk-line w-80"></div>
    </div>
  `;
  }

  function renderDashboardBars(counts) {
    const wrap = $("#dashBars");
    if (!wrap) return;

    const fmt = (n) => new Intl.NumberFormat("ar-EG").format(Number(n) || 0);

    const items = [
      {
        key: "Pending",
        label: arStatus("Pending"),
        cls: "st-pending",
        count: counts.Pending || 0,
      },
      {
        key: "Approved",
        label: arStatus("Approved"),
        cls: "st-approved",
        count: counts.Approved || 0,
      },
      {
        key: "Rejected",
        label: arStatus("Rejected"),
        cls: "st-rejected",
        count: counts.Rejected || 0,
      },
      {
        key: "Cancelled",
        label: arStatus("Cancelled"),
        cls: "st-cancelled",
        count: counts.Cancelled || 0,
      },
    ];

    const total = items.reduce((a, b) => a + (Number(b.count) || 0), 0);
    const max = Math.max(...items.map((x) => Number(x.count) || 0), 1);

    const totalEl = $("#dashTotal");
    if (totalEl) totalEl.textContent = fmt(total);

    if (total <= 0) {
      wrap.innerHTML = `<div class="status-empty">لا توجد طلبات لعرضها حالياً</div>`;
      return;
    }

    wrap.innerHTML = items
      .map((it) => {
        const c = Number(it.count) || 0;
        const pct = Math.round((c / max) * 100);
        const pctTotal = Math.round((c / total) * 100);

        return `
        <div class="status-row ${it.cls}">
          <div class="status-header">
            <div class="status-name">
              <span class="status-dot" aria-hidden="true"></span>
              <span class="status-label">${esc(it.label)}</span>
            </div>
            <span class="status-pct">${pctTotal}%</span>
          </div>

          <div class="status-count">${fmt(c)}</div>

          <div class="status-track" aria-label="مؤشر الحالة">
            <div class="status-fill" style="width:${pct}%"></div>
          </div>
        </div>
      `;
      })
      .join("");
  }

  function setStatBar(id, percent) {
    const el = $(id);
    if (!el) return;
    el.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
  }

  async function loadDashboard() {
    try {
      setLoading(true, "جاري تحميل لوحة التحكم...");

      $("#statUsers") && ($("#statUsers").textContent = "—");
      $("#statColleges") && ($("#statColleges").textContent = "—");
      $("#statDepartments") && ($("#statDepartments").textContent = "—");
      $("#statPending") && ($("#statPending").textContent = "—");
      renderDashboardBarsSkeleton();

      const [usersRes, depsRes, colsRes] = await Promise.allSettled([
        apiFetch("/api/admin/users"),
        apiFetch("/api/admin/departments"),
        apiFetch("/api/admin/colleges"),
      ]);

      if (usersRes.status === "fulfilled") {
        const { items } = parseListResponse(usersRes.value);
        state.users = items;
        $("#statUsers") && ($("#statUsers").textContent = String(items.length));
      }

      if (depsRes.status === "fulfilled") {
        const { items } = parseListResponse(depsRes.value);
        state.departments = items;
        $("#statDepartments") &&
          ($("#statDepartments").textContent = String(items.length));
      }

      if (colsRes.status === "fulfilled") {
        const { items } = parseListResponse(colsRes.value);
        state.colleges = items;
        $("#statColleges") &&
          ($("#statColleges").textContent = String(items.length));
      }

      const [pending, approved, rejected, cancelled] = await Promise.all([
        fetchRequestsCountByStatus("Pending"),
        fetchRequestsCountByStatus("Approved"),
        fetchRequestsCountByStatus("Rejected"),
        fetchRequestsCountByStatus("Cancelled"),
      ]);

      $("#statPending") && ($("#statPending").textContent = String(pending));
      setPendingBadge(pending);

      renderDashboardBars({
        Pending: pending,
        Approved: approved,
        Rejected: rejected,
        Cancelled: cancelled,
      });

      const now = new Date();
      const updated = now.toLocaleString("ar-EG", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      $("#dashUpdatedAt") && ($("#dashUpdatedAt").textContent = updated);

      const maxStat = Math.max(
        state.users.length || 0,
        state.colleges.length || 0,
        state.departments.length || 0,
        pending || 0,
        1
      );
      setStatBar("#barUsers", ((state.users.length || 0) / maxStat) * 100);
      setStatBar(
        "#barColleges",
        ((state.colleges.length || 0) / maxStat) * 100
      );
      setStatBar(
        "#barDepartments",
        ((state.departments.length || 0) / maxStat) * 100
      );
      setStatBar("#barPending", ((pending || 0) / maxStat) * 100);
    } catch (e) {
      toast("خطأ", e?.message || "فشل تحميل لوحة التحكم", "error");
    } finally {
      setLoading(false);
    }
  }

  // ---------- Users ----------
  async function ensureDepsAndCollegesLoaded() {
    if (!state.departments.length) {
      try {
        const res = await apiFetch("/api/admin/departments");
        state.departments = parseListResponse(res).items;
      } catch (_) {}
    }
    if (!state.colleges.length) {
      try {
        const res = await apiFetch("/api/admin/colleges");
        state.colleges = parseListResponse(res).items;
      } catch (_) {}
    }
  }

  function depOptions(selectedId) {
    return (
      `<option value="">—</option>` +
      state.departments
        .map((d) => {
          const id = getId(d);
          const name = d.department_name || d.name || `قسم ${id}`;
          return `<option value="${esc(id)}" ${
            String(id) === String(selectedId) ? "selected" : ""
          }>${esc(name)}</option>`;
        })
        .join("")
    );
  }

  function collegeOptions(selectedId) {
    return (
      `<option value="">—</option>` +
      state.colleges
        .map((c) => {
          const id = getId(c);
          const name = c.college_name || c.name || `كلية ${id}`;
          return `<option value="${esc(id)}" ${
            String(id) === String(selectedId) ? "selected" : ""
          }>${esc(name)}</option>`;
        })
        .join("")
    );
  }

  async function loadUsers() {
    const tb = $("#usersBody");
    if (!tb) return;

    tb.innerHTML = `<tr><td colspan="9" class="muted">جاري التحميل...</td></tr>`;

    try {
      setLoading(true, "جاري تحميل المستخدمين...");
      const res = await apiFetch("/api/admin/users");
      const { items } = parseListResponse(res);
      state.users = items;

      const search = ($("#usersSearch")?.value || "").trim().toLowerCase();
      const role = $("#usersRole")?.value || "";
      const active = $("#usersActive")?.value;

      const filtered = items.filter((u) => {
        const id = String(getId(u) ?? "");
        const name = String(pickUserName(u)).toLowerCase();
        const email = String(u.email || "").toLowerCase();
        const r = String(u.role || u.user_role || "").trim();
        const a = isUserActive(u);

        if (search) {
          const ok =
            name.includes(search) ||
            email.includes(search) ||
            id.includes(search);
          if (!ok) return false;
        }
        if (role && r !== role) return false;
        if (active === "1" && !a) return false;
        if (active === "0" && a) return false;
        return true;
      });

      if (!filtered.length) {
        tb.innerHTML = `<tr><td colspan="9" class="muted">لا توجد بيانات</td></tr>`;
        return;
      }

      tb.innerHTML = filtered
        .map((u) => {
          const id = getId(u);
          const name = pickUserName(u);
          const email = u.email || "—";
          const roleText = arRole(u.role || u.user_role || "—");
          const typeText = arUserType(pickUserType(u));
          const dep = pickDeptName(u);
          const col = pickCollegeName(u);
          const active = isUserActive(u);

          return `
            <tr>
              <td>${esc(id)}</td>
              <td>${esc(name)}</td>
              <td>${esc(email)}</td>
              <td>${esc(roleText)}</td>
              <td>${esc(typeText)}</td>
              <td>${esc(dep)}</td>
              <td>${esc(col)}</td>
              <td>${active ? "✅" : "❌"}</td>
              <td>
                <div class="row" style="gap:8px; flex-wrap:wrap">
                  <button class="btn" data-action="edit" data-id="${esc(
                    id
                  )}">تعديل</button>
                  <button class="btn danger" data-action="del" data-id="${esc(
                    id
                  )}">حذف</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      tb.querySelectorAll("button[data-action='edit']").forEach((b) => {
        b.addEventListener("click", () =>
          showUserForm("edit", b.getAttribute("data-id"))
        );
      });
      tb.querySelectorAll("button[data-action='del']").forEach((b) => {
        b.addEventListener("click", () =>
          deleteUser(b.getAttribute("data-id"))
        );
      });
    } catch (e) {
      tb.innerHTML = `<tr><td colspan="9" class="muted">فشل التحميل</td></tr>`;
      toast("خطأ", e?.message || "فشل تحميل المستخدمين", "error");
    } finally {
      setLoading(false);
    }
  }

  async function showUserForm(mode, id) {
    await ensureDepsAndCollegesLoaded();

    let user = null;
    const isEdit = mode === "edit";

    if (isEdit) {
      try {
        const res = await apiFetch(`/api/admin/users/${id}`);
        user = unwrap(res);
        user = user.user || user.data?.user || user;
      } catch (_) {
        user = state.users.find((u) => String(getId(u)) === String(id));
      }
    }

    const roleOptions = [
      { value: "Admin", label: arRole("Admin") },
      { value: "Manager", label: arRole("Manager") },
      { value: "Dean", label: arRole("Dean") },
      { value: "Head_of_Department", label: arRole("Head_of_Department") },
      { value: "Employee", label: arRole("Employee") },
      { value: "HR_Admin", label: arRole("HR_Admin") },
    ];

    const typeOptions = [
      { value: "Academic", label: arUserType("Academic") },
      { value: "Administrative", label: arUserType("Administrative") },
      { value: "All", label: arUserType("All") },
    ];

    openFancyModal({
      title: isEdit ? "تعديل مستخدم" : "إضافة مستخدم",
      subtitle: isEdit ? `معرّف المستخدم: ${id}` : "إنشاء مستخدم جديد",
      iconHtml: `<i class="fa-regular fa-user"></i>`,
      bodyHtml: `
        <div class="row" style="gap:10px; flex-wrap:wrap">
          <div style="flex:1; min-width:240px">
            <div class="muted">الاسم</div>
            <input class="input" id="uName" value="${esc(
              user?.name || user?.full_name || ""
            )}" />
          </div>
          <div style="flex:1; min-width:240px">
            <div class="muted">البريد</div>
            <input class="input" id="uEmail" value="${esc(
              user?.email || ""
            )}" ${isEdit ? "disabled" : ""}/>
          </div>
        </div>

        <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px">
          <div style="flex:1; min-width:240px">
            <div class="muted">الدور</div>
            <select class="input" id="uRole">
              ${roleOptions
                .map(
                  (r) =>
                    `<option value="${r.value}" ${
                      String(user?.role || "Employee") === r.value
                        ? "selected"
                        : ""
                    }>${esc(r.label)}</option>`
                )
                .join("")}
            </select>
          </div>
          <div style="flex:1; min-width:240px">
            <div class="muted">نوع المستخدم</div>
            <select class="input" id="uType">
              ${typeOptions
                .map(
                  (t) =>
                    `<option value="${t.value}" ${
                      String(pickUserType(user) || "All") === t.value
                        ? "selected"
                        : ""
                    }>${esc(t.label)}</option>`
                )
                .join("")}
            </select>
          </div>
        </div>

        <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px">
          <div style="flex:1; min-width:240px">
            <div class="muted">القسم</div>
            <select class="input" id="uDep">${depOptions(
              user?.department_id
            )}</select>
          </div>
          <div style="flex:1; min-width:240px">
            <div class="muted">الكلية</div>
            <select class="input" id="uCollege">${collegeOptions(
              user?.college_id
            )}</select>
          </div>
        </div>

        ${
          isEdit
            ? `
          <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px">
            <label class="checkbox-wrapper" style="min-width:240px">
              <input type="checkbox" id="uActive" ${
                isUserActive(user) ? "checked" : ""
              }/>
              <div class="checkbox-text">
                <span class="title">نشط</span>
                <p class="desc">تفعيل/تعطيل المستخدم</p>
              </div>
            </label>
          </div>
        `
            : `
          <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px">
            <div style="flex:1; min-width:240px">
              <div class="muted">الرقم القومي (إن وجد)</div>
              <input class="input" id="uSSN" placeholder="مثال: ٣٠١٠..." />
            </div>
            <div style="flex:1; min-width:240px">
              <div class="muted">كلمة المرور (إن كانت مطلوبة)</div>
              <input class="input" id="uPass" type="password" placeholder="••••••••" />
            </div>
          </div>
        `
        }
      `,
      footerHtml: `
        <button class="btn" onclick="closeModal()">إلغاء</button>
        <button class="btn primary" id="uSave">${
          isEdit ? "حفظ" : "إضافة"
        }</button>
      `,
    });

    $("#uSave")?.addEventListener("click", async () => {
      const body = {
        name: $("#uName")?.value?.trim(),
        email: $("#uEmail")?.value?.trim(),
        role: $("#uRole")?.value,
        user_type: $("#uType")?.value,

        department_id: $("#uDep")?.value ? Number($("#uDep").value) : undefined,
        college_id: $("#uCollege")?.value
          ? Number($("#uCollege").value)
          : undefined,
      };

      try {
        if (!body.name) return toast("تنبيه", "الاسم مطلوب", "warn");
        if (!isEdit && !body.email)
          return toast("تنبيه", "البريد مطلوب", "warn");

        setLoading(true, "جاري الحفظ...");

        if (isEdit) {
          body.is_active = $("#uActive")?.checked ?? true;
          await apiFetch(`/api/admin/users/${id}`, { method: "PUT", body });
          toast("تم", "تم تحديث المستخدم", "success");
        } else {
          const ssn = $("#uSSN")?.value?.trim();
          const pass = $("#uPass")?.value?.trim();
          if (ssn) body.ssn = ssn;
          if (pass) body.password = pass;

          await apiFetch(`/api/admin/users`, { method: "POST", body });
          toast("تم", "تم إضافة المستخدم", "success");
        }

        closeModal();
        await loadUsers();
        await loadDashboard();
      } catch (e) {
        toast("خطأ", e?.message || "فشل العملية", "error");
      } finally {
        setLoading(false);
      }
    });
  }

  function deleteUser(id) {
    confirmModal("حذف مستخدم", `هل تريد حذف المستخدم رقم ${id}؟`, async () => {
      await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
      toast("تم", "تم الحذف", "success");
      await loadUsers();
      await loadDashboard();
    });
  }

  // ---------- Colleges ----------
  async function loadColleges() {
    const tb = $("#collegesBody");
    if (!tb) return;

    tb.innerHTML = `<tr><td colspan="4" class="muted">جاري التحميل...</td></tr>`;

    try {
      setLoading(true, "جاري تحميل الكليات...");
      const res = await apiFetch("/api/admin/colleges");
      const { items } = parseListResponse(res);
      state.colleges = items;

      if (!items.length) {
        tb.innerHTML = `<tr><td colspan="4" class="muted">لا توجد بيانات</td></tr>`;
        return;
      }

      tb.innerHTML = items
        .map((c) => {
          const id = getId(c);
          const name = c.college_name || c.name || "—";
          const dean = c.dean_user_id ?? c.deanUserId ?? "—";
          return `
            <tr>
              <td>${esc(id)}</td>
              <td>${esc(name)}</td>
              <td>${esc(dean)}</td>
              <td>
                <div class="row" style="gap:8px; flex-wrap:wrap">
                  <button class="btn" data-action="edit" data-id="${esc(
                    id
                  )}">تعديل</button>
                  <button class="btn danger" data-action="del" data-id="${esc(
                    id
                  )}">حذف</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      tb.querySelectorAll("button[data-action='edit']").forEach((b) => {
        b.addEventListener("click", () =>
          showCollegeForm("edit", b.getAttribute("data-id"))
        );
      });
      tb.querySelectorAll("button[data-action='del']").forEach((b) => {
        b.addEventListener("click", () =>
          deleteCollege(b.getAttribute("data-id"))
        );
      });
    } catch (e) {
      tb.innerHTML = `<tr><td colspan="4" class="muted">فشل التحميل</td></tr>`;
      toast("خطأ", e?.message || "فشل تحميل الكليات", "error");
    } finally {
      setLoading(false);
    }
  }

  async function showCollegeForm(mode, id) {
    const isEdit = mode === "edit";
    const col = isEdit
      ? state.colleges.find((c) => String(getId(c)) === String(id))
      : null;

    openFancyModal({
      title: isEdit ? "تعديل كلية" : "إضافة كلية",
      subtitle: isEdit ? `معرّف الكلية: ${id}` : "إنشاء كلية جديدة",
      iconHtml: `<i class="fa-solid fa-building-columns"></i>`,
      bodyHtml: `
        <div class="row" style="gap:10px; flex-wrap:wrap">
          <div style="flex:1; min-width:260px">
            <div class="muted">اسم الكلية</div>
            <input class="input" id="cName" value="${esc(
              col?.college_name || col?.name || ""
            )}" />
          </div>
          <div style="flex:1; min-width:260px">
            <div class="muted">معرّف العميد (اختياري)</div>
            <input class="input" id="cDean" value="${esc(
              col?.dean_user_id ?? ""
            )}" placeholder="مثال: 7" />
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn" onclick="closeModal()">إلغاء</button>
        <button class="btn primary" id="cSave">${
          isEdit ? "حفظ" : "إضافة"
        }</button>
      `,
    });

    $("#cSave")?.addEventListener("click", async () => {
      const college_name = $("#cName")?.value?.trim();
      const dean_user_id = $("#cDean")?.value
        ? Number($("#cDean").value)
        : null;

      try {
        if (!college_name) return toast("تنبيه", "اسم الكلية مطلوب", "warn");

        setLoading(true, "جاري الحفظ...");

        if (isEdit) {
          await apiFetch(`/api/admin/colleges/${id}`, {
            method: "PUT",
            body: { college_name, dean_user_id, deanUserId: dean_user_id },
          });
          toast("تم", "تم تحديث الكلية", "success");
        } else {
          await apiFetch(`/api/admin/colleges`, {
            method: "POST",
            body: { college_name, dean_user_id },
          });
          toast("تم", "تم إضافة الكلية", "success");
        }

        closeModal();
        await loadColleges();
        await loadDashboard();
      } catch (e) {
        toast("خطأ", e?.message || "فشل العملية", "error");
      } finally {
        setLoading(false);
      }
    });
  }

  function deleteCollege(id) {
    confirmModal("حذف كلية", `هل تريد حذف الكلية رقم ${id}؟`, async () => {
      await apiFetch(`/api/admin/colleges/${id}`, { method: "DELETE" });
      toast("تم", "تم الحذف", "success");
      await loadColleges();
      await loadDashboard();
    });
  }

  // ---------- Departments ----------
  async function loadDepartments() {
    const tb = $("#depsBody");
    if (!tb) return;

    tb.innerHTML = `<tr><td colspan="5" class="muted">جاري التحميل...</td></tr>`;

    try {
      setLoading(true, "جاري تحميل الأقسام...");
      const res = await apiFetch("/api/admin/departments");
      const { items } = parseListResponse(res);
      state.departments = items;

      if (!items.length) {
        tb.innerHTML = `<tr><td colspan="5" class="muted">لا توجد بيانات</td></tr>`;
        return;
      }

      tb.innerHTML = items
        .map((d) => {
          const id = getId(d);
          const name = d.department_name || d.name || "—";
          const collegeId = d.college_id ?? d.college?.id ?? "—";
          const head = d.head_user_id ?? d.headUserId ?? "—";
          return `
            <tr>
              <td>${esc(id)}</td>
              <td>${esc(name)}</td>
              <td>${esc(collegeId)}</td>
              <td>${esc(head)}</td>
              <td>
                <div class="row" style="gap:8px; flex-wrap:wrap">
                  <button class="btn" data-action="edit" data-id="${esc(
                    id
                  )}">تعديل</button>
                  <button class="btn danger" data-action="del" data-id="${esc(
                    id
                  )}">حذف</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      tb.querySelectorAll("button[data-action='edit']").forEach((b) => {
        b.addEventListener("click", () =>
          showDepartmentForm("edit", b.getAttribute("data-id"))
        );
      });
      tb.querySelectorAll("button[data-action='del']").forEach((b) => {
        b.addEventListener("click", () =>
          deleteDepartment(b.getAttribute("data-id"))
        );
      });
    } catch (e) {
      tb.innerHTML = `<tr><td colspan="5" class="muted">فشل التحميل</td></tr>`;
      toast("خطأ", e?.message || "فشل تحميل الأقسام", "error");
    } finally {
      setLoading(false);
    }
  }

  async function showDepartmentForm(mode, id) {
    await ensureDepsAndCollegesLoaded();

    const isEdit = mode === "edit";
    const dep = isEdit
      ? state.departments.find((d) => String(getId(d)) === String(id))
      : null;

    openFancyModal({
      title: isEdit ? "تعديل قسم" : "إضافة قسم",
      subtitle: isEdit ? `معرّف القسم: ${id}` : "إنشاء قسم جديد",
      iconHtml: `<i class="fa-solid fa-building"></i>`,
      bodyHtml: `
        <div class="row" style="gap:10px; flex-wrap:wrap">
          <div style="flex:1; min-width:260px">
            <div class="muted">اسم القسم</div>
            <input class="input" id="dName" value="${esc(
              dep?.department_name || dep?.name || ""
            )}" ${isEdit ? "disabled" : ""}/>
          </div>

          <div style="flex:1; min-width:260px">
            <div class="muted">الكلية</div>
            <select class="input" id="dCollege">${collegeOptions(
              dep?.college_id
            )}</select>
          </div>
        </div>

        <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px">
          <div style="flex:1; min-width:260px">
            <div class="muted">معرّف رئيس القسم</div>
            <input class="input" id="dHead" value="${esc(
              dep?.head_user_id ?? ""
            )}" placeholder="مثال: 6" />
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn" onclick="closeModal()">إلغاء</button>
        <button class="btn primary" id="dSave">${
          isEdit ? "حفظ" : "إضافة"
        }</button>
      `,
    });

    $("#dSave")?.addEventListener("click", async () => {
      const college_id = $("#dCollege")?.value
        ? Number($("#dCollege").value)
        : undefined;
      const head_user_id = $("#dHead")?.value
        ? Number($("#dHead").value)
        : undefined;
      const department_name = $("#dName")?.value?.trim();

      try {
        setLoading(true, "جاري الحفظ...");

        if (isEdit) {
          await apiFetch(`/api/admin/departments/${id}`, {
            method: "PUT",
            body: { head_user_id, headUserId: head_user_id, college_id },
          });
          toast("تم", "تم تحديث القسم", "success");
        } else {
          if (!department_name || !college_id)
            return toast("تنبيه", "الاسم والكلية مطلوبان", "warn");
          await apiFetch(`/api/admin/departments`, {
            method: "POST",
            body: { department_name, college_id },
          });
          toast("تم", "تم إضافة القسم", "success");
        }

        closeModal();
        await loadDepartments();
        await loadDashboard();
      } catch (e) {
        toast("خطأ", e?.message || "فشل العملية", "error");
      } finally {
        setLoading(false);
      }
    });
  }

  function deleteDepartment(id) {
    confirmModal("حذف قسم", `هل تريد حذف القسم رقم ${id}؟`, async () => {
      await apiFetch(`/api/admin/departments/${id}`, { method: "DELETE" });
      toast("تم", "تم الحذف", "success");
      await loadDepartments();
      await loadDashboard();
    });
  }

  // ---------- Leave Types ----------
  async function loadLeaveTypes() {
    const tb = $("#typesBody");
    if (!tb) return;

    tb.innerHTML = `<tr><td colspan="9" class="muted">جاري التحميل...</td></tr>`;

    try {
      setLoading(true, "جاري تحميل أنواع الإجازات...");
      const res = await apiFetch("/api/admin/leave-types");
      const { items } = parseListResponse(res);
      state.leaveTypes = items;

      const search = ($("#typesSearch")?.value || "").trim().toLowerCase();

      const filtered = items.filter((t) => {
        if (!search) return true;
        const name = String(t.type_name || t.name || "").toLowerCase();
        const cat = String(t.category || "").toLowerCase();
        return name.includes(search) || cat.includes(search);
      });

      if (!filtered.length) {
        tb.innerHTML = `<tr><td colspan="9" class="muted">لا توجد بيانات</td></tr>`;
        return;
      }

      tb.innerHTML = filtered
        .map((t) => {
          const id = getId(t);
          const name = t.type_name || t.name || "—";
          const categoryRaw = t.category || "—";
          const category = arCategory(categoryRaw);

          const balanceTypeRaw = t.balance_type || "—";
          const balanceType = arBalanceType(balanceTypeRaw);

          const fixed = t.fixed_balance ?? "—";

          const docs = Array.isArray(t.required_documents)
            ? t.required_documents.length
            : t.requires_document
            ? "نعم"
            : "لا";

          const gender = arGender(t.gender_policy || "—");
          const max = t.max_days_per_request ?? "—";

          return `
            <tr>
              <td>${esc(id)}</td>
              <td>${esc(name)}</td>
              <td>${esc(category)}</td>
              <td>${esc(balanceType)}${
            String(balanceTypeRaw).toLowerCase() === "fixed"
              ? ` (${esc(fixed)})`
              : ""
          }</td>
              <td>${esc(fixed)}</td>
              <td>${esc(docs)}</td>
              <td>${esc(gender)}</td>
              <td>${esc(max)}</td>
              <td>
                <div class="row" style="gap:8px; flex-wrap:wrap">
                  <button class="btn" data-action="edit" data-id="${esc(
                    id
                  )}">تعديل</button>
                  <button class="btn danger" data-action="del" data-id="${esc(
                    id
                  )}">حذف</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      tb.querySelectorAll("button[data-action='edit']").forEach((b) => {
        b.addEventListener("click", () =>
          showLeaveTypeForm("edit", b.getAttribute("data-id"))
        );
      });
      tb.querySelectorAll("button[data-action='del']").forEach((b) => {
        b.addEventListener("click", () =>
          deleteLeaveType(b.getAttribute("data-id"))
        );
      });
    } catch (e) {
      tb.innerHTML = `<tr><td colspan="9" class="muted">فشل التحميل</td></tr>`;
      toast("خطأ", e?.message || "فشل تحميل أنواع الإجازات", "error");
    } finally {
      setLoading(false);
    }
  }

  function docsToTextarea(required_documents) {
    if (!Array.isArray(required_documents)) return "";
    return required_documents
      .map((d) =>
        `${d.is_mandatory ? "* " : ""}${d.document_name || d.name || ""}`.trim()
      )
      .filter(Boolean)
      .join("\n");
  }

  function textareaToDocs(text) {
    const lines = String(text || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    return lines.map((l) => {
      const mandatory = l.startsWith("*");
      const name = l.replace(/^\*\s*/, "").trim();
      return { document_name: name, is_mandatory: mandatory || true };
    });
  }

  async function showLeaveTypeForm(mode, id) {
    const isEdit = mode === "edit";
    const t = isEdit
      ? state.leaveTypes.find((x) => String(getId(x)) === String(id))
      : null;

    const categoryOptions = [
      { value: "Paid", label: arCategory("Paid") },
      { value: "Unpaid", label: arCategory("Unpaid") },
    ];

    const balanceOptions = [
      { value: "fixed", label: arBalanceType("fixed") },
      { value: "calculated", label: arBalanceType("calculated") },
    ];

    const genderOptions = [
      { value: "All", label: arGender("All") },
      { value: "Male", label: arGender("Male") },
      { value: "Female", label: arGender("Female") },
    ];

    openFancyModal({
      title: isEdit ? "تعديل نوع إجازة" : "إضافة نوع إجازة",
      subtitle: isEdit ? `معرّف النوع: ${id}` : "إنشاء نوع جديد",
      iconHtml: `<i class="fa-solid fa-list-check"></i>`,
      bodyHtml: `
        <div class="row" style="gap:10px; flex-wrap:wrap">
          <div style="flex:2; min-width:240px">
            <div class="muted">اسم النوع</div>
            <input class="input" id="tName" value="${esc(
              t?.type_name || ""
            )}" />
          </div>
          <div style="flex:1; min-width:220px">
            <div class="muted">الفئة</div>
            <select class="input" id="tCategory">
              ${categoryOptions
                .map(
                  (c) =>
                    `<option value="${c.value}" ${
                      String(t?.category || "Paid") === c.value
                        ? "selected"
                        : ""
                    }>${esc(c.label)}</option>`
                )
                .join("")}
            </select>
          </div>
        </div>

        <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px">
          <div style="flex:1; min-width:220px">
            <div class="muted">نوع الرصيد</div>
            <select class="input" id="tBalanceType">
              ${balanceOptions
                .map(
                  (b) =>
                    `<option value="${b.value}" ${
                      String(t?.balance_type || "fixed") === b.value
                        ? "selected"
                        : ""
                    }>${esc(b.label)}</option>`
                )
                .join("")}
            </select>
          </div>
          <div style="flex:1; min-width:220px">
            <div class="muted">الرصيد الثابت</div>
            <input class="input" id="tFixed" value="${esc(
              t?.fixed_balance ?? ""
            )}" placeholder="مثال: 15" />
          </div>
          <div style="flex:1; min-width:220px">
            <div class="muted">أقصى مدة للطلب</div>
            <input class="input" id="tMax" value="${esc(
              t?.max_days_per_request ?? ""
            )}" placeholder="مثال: 5" />
          </div>
        </div>

        <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px">
          <div style="flex:1; min-width:220px">
            <div class="muted">سياسة النوع</div>
            <select class="input" id="tGender">
              ${genderOptions
                .map(
                  (g) =>
                    `<option value="${g.value}" ${
                      String(t?.gender_policy || "All") === g.value
                        ? "selected"
                        : ""
                    }>${esc(g.label)}</option>`
                )
                .join("")}
            </select>
          </div>

          <label class="checkbox-wrapper" style="min-width:260px">
            <input type="checkbox" id="tReqDoc" ${
              t?.requires_document ? "checked" : ""
            } />
            <div class="checkbox-text">
              <span class="title">يتطلب مستندات</span>
              <p class="desc">هل يحتاج مستندات داعمة؟</p>
            </div>
          </label>
        </div>

        <div style="margin-top:10px">
          <div class="muted">الوصف</div>
          <input class="input" id="tDesc" value="${esc(
            t?.description || ""
          )}" />
        </div>

        <div style="margin-top:10px">
          <div class="muted">المستندات المطلوبة (سطر لكل مستند — ابدأ بـ * لو إلزامي)</div>
          <textarea class="input" id="tDocs" style="min-height:120px; resize:vertical">${esc(
            docsToTextarea(t?.required_documents)
          )}</textarea>
        </div>
      `,
      footerHtml: `
        <button class="btn" onclick="closeModal()">إلغاء</button>
        <button class="btn primary" id="tSave">${
          isEdit ? "حفظ" : "إضافة"
        }</button>
      `,
    });

    $("#tSave")?.addEventListener("click", async () => {
      const body = {
        type_name: $("#tName")?.value?.trim(),
        category: $("#tCategory")?.value,
        balance_type: $("#tBalanceType")?.value,
        fixed_balance: $("#tFixed")?.value ? Number($("#tFixed").value) : 0,
        max_days_per_request: $("#tMax")?.value
          ? Number($("#tMax").value)
          : undefined,
        gender_policy: $("#tGender")?.value,
        requires_document: $("#tReqDoc")?.checked ?? false,
        description: $("#tDesc")?.value?.trim(),
      };

      const docsText = $("#tDocs")?.value || "";
      const docs = textareaToDocs(docsText);
      if (docs.length) body.required_documents = docs;

      try {
        if (!body.type_name) return toast("تنبيه", "اسم النوع مطلوب", "warn");

        setLoading(true, "جاري الحفظ...");

        if (isEdit) {
          await apiFetch(`/api/admin/leave-types/${id}`, {
            method: "PUT",
            body,
          });
          toast("تم", "تم تحديث نوع الإجازة", "success");
        } else {
          body.calculation_method =
            String(body.balance_type).toLowerCase() === "calculated"
              ? "Egypt_Labor_Law"
              : "Fixed";
          await apiFetch(`/api/admin/leave-types`, { method: "POST", body });
          toast("تم", "تم إضافة نوع الإجازة", "success");
        }

        closeModal();
        await loadLeaveTypes();
        await loadDashboard();
        await populateReportsFilters();
      } catch (e) {
        toast("خطأ", e?.message || "فشل العملية", "error");
      } finally {
        setLoading(false);
      }
    });
  }

  function deleteLeaveType(id) {
    confirmModal("حذف نوع إجازة", `هل تريد حذف النوع رقم ${id}؟`, async () => {
      await apiFetch(`/api/admin/leave-types/${id}`, { method: "DELETE" });
      toast("تم", "تم الحذف", "success");
      await loadLeaveTypes();
      await loadDashboard();
      await populateReportsFilters();
    });
  }

  // ---------- Eligibility (Rules) ----------
  async function loadEligibility() {
    const tb = $("#rulesBody");
    if (!tb) return;

    tb.innerHTML = `<tr><td colspan="4" class="muted">جاري التحميل...</td></tr>`;

    try {
      setLoading(true, "جاري تحميل الصلاحيات...");

      const res = await apiFetch("/api/admin/leave-eligibility");
      const { items } = parseListResponse(res);
      state.eligibility = items;

      if (!state.leaveTypes.length) {
        try {
          const t = await apiFetch("/api/admin/leave-types");
          state.leaveTypes = parseListResponse(t).items;
        } catch (_) {}
      }

      const typeMap = new Map(
        state.leaveTypes.map((t) => [
          String(getId(t)),
          t.type_name || t.name || `نوع ${getId(t)}`,
        ])
      );

      if (!items.length) {
        tb.innerHTML = `<tr><td colspan="4" class="muted">لا توجد بيانات</td></tr>`;
        return;
      }

      tb.innerHTML = items
        .map((r) => {
          const id = getId(r);
          const leaveTypeId =
            r.leave_type_id ?? r.leaveTypeId ?? r.leave_type?.id;
          const typeName =
            typeMap.get(String(leaveTypeId)) || leaveTypeId || "—";
          const eligibleRaw = r.eligible_user_type ?? r.eligibleUserType ?? "—";
          const eligible = arUserType(eligibleRaw);

          return `
            <tr>
              <td>${esc(id)}</td>
              <td>${esc(typeName)}</td>
              <td>${esc(eligible)}</td>
              <td>
                <div class="row" style="gap:8px; flex-wrap:wrap">
                  <button class="btn danger" data-action="del" data-id="${esc(
                    id
                  )}">حذف</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      tb.querySelectorAll("button[data-action='del']").forEach((b) => {
        b.addEventListener("click", () =>
          deleteEligibilityRule(b.getAttribute("data-id"))
        );
      });
    } catch (e) {
      tb.innerHTML = `<tr><td colspan="4" class="muted">فشل التحميل</td></tr>`;
      toast("خطأ", e?.message || "فشل تحميل الصلاحيات", "error");
    } finally {
      setLoading(false);
    }
  }

  async function showEligibilityForm() {
    if (!state.leaveTypes.length) await loadLeaveTypes();

    const options = state.leaveTypes
      .map(
        (t) =>
          `<option value="${esc(getId(t))}">${esc(
            t.type_name || t.name || getId(t)
          )}</option>`
      )
      .join("");

    openFancyModal({
      title: "إضافة قاعدة",
      subtitle: "تحديد صلاحية نوع الإجازة",
      iconHtml: `<i class="fa-solid fa-shield"></i>`,
      bodyHtml: `
        <div class="row" style="gap:10px; flex-wrap:wrap">
          <div style="flex:1; min-width:260px">
            <div class="muted">نوع الإجازة</div>
            <select class="input" id="eType">${options}</select>
          </div>
          <div style="flex:1; min-width:260px">
            <div class="muted">نوع المستخدم</div>
            <select class="input" id="eUserType">
              <option value="All">${esc(arUserType("All"))}</option>
              <option value="Academic">${esc(arUserType("Academic"))}</option>
              <option value="Administrative">${esc(
                arUserType("Administrative")
              )}</option>
            </select>
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn" onclick="closeModal()">إلغاء</button>
        <button class="btn primary" id="eSave">إضافة</button>
      `,
    });

    $("#eSave")?.addEventListener("click", async () => {
      const leave_type_id = Number($("#eType")?.value);
      const eligible_user_type = $("#eUserType")?.value;

      try {
        setLoading(true, "جاري الإضافة...");
        await apiFetch("/api/admin/leave-eligibility", {
          method: "POST",
          body: { leave_type_id, eligible_user_type },
        });
        toast("تم", "تم إضافة القاعدة", "success");
        closeModal();
        await loadEligibility();
      } catch (e) {
        toast("خطأ", e?.message || "فشل العملية", "error");
      } finally {
        setLoading(false);
      }
    });
  }

  function deleteEligibilityRule(id) {
    confirmModal("حذف قاعدة", `هل تريد حذف القاعدة رقم ${id}؟`, async () => {
      await apiFetch(`/api/admin/leave-eligibility/${id}`, {
        method: "DELETE",
      });
      toast("تم", "تم الحذف", "success");
      await loadEligibility();
    });
  }

  // ---------- Reports ----------
  async function populateReportsFilters() {
    const depSel = $("#repDept");
    if (depSel) {
      if (!state.departments.length) {
        try {
          const res = await apiFetch("/api/admin/departments");
          state.departments = parseListResponse(res).items;
        } catch (_) {}
      }

      const current = depSel.value || "";
      const opts =
        `<option value="">كل الأقسام</option>` +
        state.departments
          .map((d) => {
            const id = getId(d);
            const name = d.department_name || d.name || id;
            return `<option value="${esc(id)}">${esc(name)}</option>`;
          })
          .join("");

      depSel.innerHTML = opts;
      depSel.value = current;
    }

    const typeSel = $("#repType");
    if (typeSel) {
      if (!state.leaveTypes.length) {
        try {
          const res = await apiFetch("/api/admin/leave-types");
          state.leaveTypes = parseListResponse(res).items;
        } catch (_) {}
      }

      const current = typeSel.value || "";
      const opts =
        `<option value="">كل الأنواع</option>` +
        state.leaveTypes
          .map((t) => {
            const id = getId(t);
            const name = t.type_name || t.name || id;
            return `<option value="${esc(id)}">${esc(name)}</option>`;
          })
          .join("");

      typeSel.innerHTML = opts;
      typeSel.value = current;
    }
  }

  function readReportFiltersFromUI() {
    const status = $("#repStatus")?.value || "";
    const deptId = $("#repDept")?.value || "";
    const typeId = $("#repType")?.value || "";
    const user = ($("#repUser")?.value || "").trim();
    const start = $("#repStart")?.value || "";
    const end = $("#repEnd")?.value || "";
    const limit = Number($("#repLimit")?.value || 25) || 25;

    return { status, deptId, typeId, user, start, end, limit };
  }

  function renderReportsTable(items) {
    const tb = $("#repBody");
    if (!tb) return;

    if (!items?.length) {
      tb.innerHTML = `<tr><td colspan="8" class="muted">لا توجد بيانات</td></tr>`;
      return;
    }

    tb.innerHTML = items
      .map((r, idx) => {
        const id = getId(r);
        const emp =
          r.employee_name ||
          r.employee?.name ||
          r.user?.name ||
          r.user_name ||
          r.user?.full_name ||
          "—";

        const type =
          r.leave_type_name ||
          r.leave_type?.type_name ||
          r.leaveType?.type_name ||
          r.leave_type?.name ||
          "—";

        const from = r.start_date || r.from || r.startDate || "—";
        const to = r.end_date || r.to || r.endDate || "—";
        const statusRaw = r.status || r.current_status || "—";
        const status = arStatus(statusRaw);
        const duration = calcDurationDays(from, to);

        return `
          <tr>
            <td>${esc(id || idx + 1)}</td>
            <td>${esc(emp)}</td>
            <td>${esc(type)}</td>
            <td>${esc(from)}</td>
            <td>${esc(to)}</td>
            <td>${esc(duration)}</td>
            <td><span class="pill">${esc(status)}</span></td>
            <td>
              <div class="row" style="gap:8px; flex-wrap:wrap">
                <button class="btn" data-action="details" data-id="${esc(
                  id
                )}">تفاصيل</button>
                <button class="btn primary" data-action="override" data-id="${esc(
                  id
                )}">تعديل الحالة</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    tb.querySelectorAll("button[data-action='details']").forEach((b) => {
      b.addEventListener("click", async () => {
        const id = b.getAttribute("data-id");
        let item = state.report.items.find(
          (x) => String(getId(x)) === String(id)
        );

        if (!item) {
          try {
            const res = await apiFetch(`/api/admin/leave-requests/${id}`);
            item = unwrap(res);
          } catch (_) {}
        }

        openRequestDetailsModal(item || {}, id);
      });
    });

    tb.querySelectorAll("button[data-action='override']").forEach((b) => {
      b.addEventListener("click", () =>
        showOverrideModal(b.getAttribute("data-id"))
      );
    });
  }

  async function loadReports({ reset } = {}) {
    await populateReportsFilters();

    if (reset) state.report.page = 1;

    const filters = readReportFiltersFromUI();
    state.report.limit = filters.limit;
    state.report.lastFilters = filters;

    const offset = (state.report.page - 1) * state.report.limit;

    const queryVariants = [
      buildQuery({
        status: filters.status,
        department_id: filters.deptId,
        leave_type_id: filters.typeId,
        user: filters.user,
        user_id: filters.user,
        start_date: filters.start,
        end_date: filters.end,
        limit: state.report.limit,
        offset,
      }),
      buildQuery({
        status: filters.status,
        departmentId: filters.deptId,
        leaveTypeId: filters.typeId,
        userId: filters.user,
        startDate: filters.start,
        endDate: filters.end,
        limit: state.report.limit,
        offset,
      }),
      buildQuery({
        status: filters.status,
        department_id: filters.deptId,
        leave_type_id: filters.typeId,
        user_id: filters.user,
        from: filters.start,
        to: filters.end,
        page: state.report.page,
        pageSize: state.report.limit,
      }),
    ];

    const tb = $("#repBody");
    tb &&
      (tb.innerHTML = `<tr><td colspan="8" class="muted">جاري التحميل...</td></tr>`);

    try {
      setLoading(true, "جاري تحميل التقارير...");

      let res = null;
      let lastErr = null;

      for (const q of queryVariants) {
        try {
          res = await apiFetch(`/api/admin/leave-requests${q}`);
          break;
        } catch (e) {
          lastErr = e;
        }
      }

      if (!res) throw lastErr || new Error("فشل تحميل التقارير");

      const { items, total } = parseListResponse(res);

      state.report.items = items;
      state.report.total =
        total !== undefined && total !== null
          ? Number(total) || 0
          : (state.report.page - 1) * state.report.limit + items.length;

      state.report.hasNext =
        total !== undefined && total !== null
          ? offset + items.length < state.report.total
          : items.length === state.report.limit;

      $("#repTotal") &&
        ($("#repTotal").textContent = String(state.report.total));
      $("#repPage") && ($("#repPage").textContent = String(state.report.page));

      const prev = $("#repPrevBtn");
      const next = $("#repNextBtn");
      if (prev) prev.disabled = state.report.page <= 1;
      if (next) next.disabled = !state.report.hasNext;

      renderReportsTable(items);
    } catch (e) {
      toast("خطأ", e?.message || "فشل تحميل التقارير", "error");
      $("#repBody") &&
        ($(
          "#repBody"
        ).innerHTML = `<tr><td colspan="8" class="muted">فشل التحميل</td></tr>`);
    } finally {
      setLoading(false);
    }
  }

  function showOverrideModal(requestId) {
    const statusOptions = [
      { value: "Approved", label: arStatus("Approved") },
      { value: "Rejected", label: arStatus("Rejected") },
      { value: "Pending", label: arStatus("Pending") },
      { value: "Cancelled", label: arStatus("Cancelled") },
    ];

    openFancyModal({
      title: "تعديل حالة الطلب",
      subtitle: `رقم الطلب: ${requestId}`,
      iconHtml: `<i class="fa-solid fa-pen-to-square"></i>`,
      bodyHtml: `
        <div class="row" style="gap:10px; flex-wrap:wrap">
          <div style="flex:1; min-width:220px">
            <div class="muted">الحالة الجديدة</div>
            <select class="input" id="ovStatus">
              ${statusOptions
                .map(
                  (s) => `<option value="${s.value}">${esc(s.label)}</option>`
                )
                .join("")}
            </select>
          </div>
          <div style="flex:2; min-width:260px">
            <div class="muted">سبب التعديل</div>
            <input class="input" id="ovReason" placeholder="اكتب السبب..." />
          </div>
        </div>
      `,
      footerHtml: `
        <button class="btn" onclick="closeModal()">إلغاء</button>
        <button class="btn primary" id="ovSave">حفظ</button>
      `,
    });

    $("#ovSave")?.addEventListener("click", async () => {
      const newStatus = $("#ovStatus")?.value;
      const reason = $("#ovReason")?.value?.trim() || "";

      const payload = {
        status: newStatus,
        new_status: newStatus,
        newStatus,
        reason,
        comment: reason,
        notes: reason,
      };

      try {
        setLoading(true, "جاري تنفيذ التعديل...");
        await apiFetch(
          `/api/admin/leave-requests/${requestId}/override-status`,
          { method: "PUT", body: payload }
        );

        toast("تم", "تم تعديل الحالة بنجاح", "success");
        closeModal();

        await loadDashboard();
        await loadReports({ reset: false });
      } catch (e) {
        toast("خطأ", e?.message || "فشل تعديل الحالة", "error");
      } finally {
        setLoading(false);
      }
    });
  }

  function formatFileDate(d = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  }

  function buildReportExportRows(items) {
    return (items || []).map((r) => {
      const id = getId(r);

      const emp =
        r.employee_name ||
        r.employee?.name ||
        r.user?.name ||
        r.user_name ||
        r.user?.full_name ||
        "—";

      const type =
        r.leave_type_name ||
        r.leave_type?.type_name ||
        r.leaveType?.type_name ||
        r.leave_type?.name ||
        "—";

      const from = r.start_date || r.from || r.startDate || "—";
      const to = r.end_date || r.to || r.endDate || "—";
      const statusRaw = r.status || r.current_status || "—";
      const status = arStatus(statusRaw);
      const duration = calcDurationDays(from, to);

      return {
        "رقم الطلب": id ?? "",
        الموظف: emp,
        "نوع الإجازة": type,
        من: from,
        إلى: to,
        المدة: duration,
        الحالة: status,
      };
    });
  }

  function downloadCSV(rows, filename) {
    const cols = Object.keys(rows[0] || {});
    const escCSV = (v) => {
      const s = String(v ?? "");
      return `"${s.replaceAll('"', '""')}"`;
    };

    const lines = [
      cols.map(escCSV).join(","),
      ...rows.map((r) => cols.map((c) => escCSV(r[c])).join(",")),
    ];

    const csv = "\ufeff" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename.endsWith(".csv") ? filename : filename + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function exportReportsToExcel() {
    const items = state.report?.items || [];
    if (!items.length) return toast("تنبيه", "لا توجد بيانات للتصدير", "warn");

    const rows = buildReportExportRows(items);
    const name = `طلبات_الإجازات_${formatFileDate(new Date())}`;

    if (window.XLSX) {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "طلبات الإجازات");
      XLSX.writeFile(wb, `${name}.xlsx`);
      return;
    }

    downloadCSV(rows, `${name}.csv`);
  }

  // ---------- Boot ----------
  async function bootAfterToken() {
    if (!getToken()) return;

    try {
      setLoading(true, "جاري تهيئة النظام...");
      await loadProfile();

      const activeTab =
        $(".nav-tab.active")?.getAttribute("data-tab") || "dashboard";
      await onTabChanged(activeTab);

      await populateReportsFilters();
    } finally {
      setLoading(false);
    }
  }

  function wireButtons() {
    $("#refreshBtn")?.addEventListener("click", async () => {
      if (!getToken()) return toast("تنبيه", "أدخل التوكن أولاً", "warn");
      const activeTab =
        $(".nav-tab.active")?.getAttribute("data-tab") || "dashboard";
      await Promise.allSettled([onTabChanged(activeTab)]);
      toast("تم", "تم تحديث البيانات", "success");
    });

    $("#usersRefreshBtn")?.addEventListener("click", loadUsers);
    $("#usersAddBtn")?.addEventListener("click", () => showUserForm("add"));
    $("#usersSearch")?.addEventListener("input", () => loadUsers());
    $("#usersRole")?.addEventListener("change", () => loadUsers());
    $("#usersActive")?.addEventListener("change", () => loadUsers());

    $("#collegesRefreshBtn")?.addEventListener("click", loadColleges);
    $("#collegesAddBtn")?.addEventListener("click", () =>
      showCollegeForm("add")
    );
    $("#depsRefreshBtn")?.addEventListener("click", loadDepartments);
    $("#depsAddBtn")?.addEventListener("click", () =>
      showDepartmentForm("add")
    );

    $("#typesRefreshBtn")?.addEventListener("click", loadLeaveTypes);
    $("#typesAddBtn")?.addEventListener("click", () =>
      showLeaveTypeForm("add")
    );
    $("#typesSearch")?.addEventListener("input", () => loadLeaveTypes());

    $("#rulesRefreshBtn")?.addEventListener("click", loadEligibility);
    $("#rulesAddBtn")?.addEventListener("click", showEligibilityForm);

    $("#repRefreshBtn")?.addEventListener("click", async () => {
      await loadReports({ reset: false });
      toast("تم", "تم تحديث التقرير", "success");
    });

    $("#repExportBtn")?.addEventListener("click", () => exportReportsToExcel());

    $("#repLoadBtn")?.addEventListener("click", () =>
      loadReports({ reset: true })
    );
    $("#repPrevBtn")?.addEventListener("click", async () => {
      if (state.report.page <= 1) return;
      state.report.page -= 1;
      await loadReports({ reset: false });
    });
    $("#repNextBtn")?.addEventListener("click", async () => {
      if (!state.report.hasNext) return;
      state.report.page += 1;
      await loadReports({ reset: false });
    });
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      wireModalClose?.();
      initTabs();
      initUserMenu();
      initSettings();
      wireButtons();

      renderProfile(null);

      if (getToken()) {
        await bootAfterToken();
      } else {
        setBadge(0);
        setPendingBadge(0);
        toast(
          "تنبيه",
          "اذهب للإعدادات وضع التوكن أو استخدم تسجيل الدخول",
          "warn"
        );
      }
    } catch (e) {
      toast("خطأ", e?.message || "فشل تشغيل الصفحة", "error");
    }
  });
})();
