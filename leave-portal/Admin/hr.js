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
      "[hr.js] تأكد من تحميل common.js قبل hr.js لأن بعض الدوال المطلوبة غير موجودة.",
    );
  }

  // ---------- قاموس التعريب (للعرض فقط) ----------
  const AR = {
    roles: {
      Admin: "مسؤول النظام",
      Manager: "مدير",
      Dean: "عميد",
      President: "رئيس الجامعة",
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
  // Helper: Ensure Users are loaded (to map IDs -> Names)
  async function ensureUsersLoaded() {
    if (state.users.length > 0) return;
    try {
      const res = await apiFetch("/api/admin/users");
      state.users = parseListResponse(res).items;
    } catch (e) {
      console.error("Failed to load users for mapping", e);
    }
  }

  // Helper: Ensure Colleges are loaded (to map College ID -> College Name)
  async function ensureCollegesLoaded() {
    if (state.colleges.length > 0) return;
    try {
      const res = await apiFetch("/api/admin/colleges");
      state.colleges = parseListResponse(res).items;
    } catch (e) {
      console.error("Failed to load colleges for mapping", e);
    }
  }

  function mapCI(map, value, fallback = "—") {
    const v = String(value ?? "").trim();
    if (!v) return fallback;
    const key = Object.keys(map).find(
      (k) => k.toLowerCase() === v.toLowerCase(),
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
      obj?.request_id ??
      obj?.user_id ??
      obj?.department_id ??
      obj?.college_id ??
      obj?.leave_type_id ??
      obj?.rule_id ??
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

  function setPendingBadge(count) {
    const b = $("#pendingBadge");
    if (!b) return;
    b.textContent = String(Number(count) || 0);
  }

  // ---------- Generic Modal ----------
  function openFancyModal({ title, subtitle, iconHtml, bodyHtml, footerHtml }) {
    openModal(`
      <div class="modal-header" style="background: linear-gradient(135deg, #014366, #0F93B4); color: white; display: flex; justify-content: space-between; align-items: center; padding: 15px 20px;">
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: rgba(255,255,255,0.15); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 18px;">
                 ${iconHtml || '<i class="fa-solid fa-circle-info"></i>'}
            </div>
            <div>
                 <h3 style="margin: 0; font-size: 18px; font-weight: 700;">${esc(title || "")}</h3>
                 ${subtitle ? `<div style="font-size: 13px; opacity: 0.85; margin-top: 2px;">${esc(subtitle)}</div>` : ""}
            </div>
        </div>

        <button onclick="closeModal()" class="modal-close-icon">
            <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="modal-body" style="padding: 20px;">
        ${bodyHtml || ""}
      </div>

      ${footerHtml ? `<div class="modal-footer" style="padding: 15px 20px; background: #f8fafc; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px;">${footerHtml}</div>` : ""}
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

  // ---------- Request Details Modal (Cairo Font + Perfect Print) ----------
  function openRequestDetailsModal(req, requestId) {
    const id = requestId || getId(req) || "—";

    const formatDate = (dateStr) => {
      if (!dateStr || dateStr === "—") return "—";
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString("ar-EG");
      } catch (e) {
        return dateStr;
      }
    };

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
      "—",
    );
    const jobTitle = getDeep(
      req,
      ["employee.job_title", "user.job_title", "job_title"],
      "—",
    );
    const deptName = getDeep(
      req,
      ["department_name", "department.name", "employee.department.name"],
      "—",
    );
    const collegeName = getDeep(
      req,
      ["college_name", "college.name", "employee.college.name"],
      "—",
    );

    const leaveType = getDeep(
      req,
      [
        "leave_type_name",
        "leave_type.type_name",
        "leaveType.type_name",
        "leave_type.name",
      ],
      "—",
    );
    const from = getDeep(req, ["start_date", "from", "startDate"], "—");
    const to = getDeep(req, ["end_date", "to", "endDate"], "—");
    const createdAt = getDeep(
      req,
      ["created_at", "createdAt"],
      new Date().toISOString(),
    );
    const reason = getDeep(
      req,
      ["reason", "comment", "notes", "description"],
      "—",
    );
    const duration =
      from !== "—" && to !== "—" ? calcDurationDays(from, to) : "—";

    const status = arStatus(req.status || "Pending");
    const managerName = req.manager_name || "المدير المباشر";

    openModal(`
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">

      <style>
        /* تصميم الورقة */
        .official-paper {
            background: white;
            padding: 40px;
            color: #000;
            font-family: 'Cairo', sans-serif; /* الخط الجديد */
            border: 1px solid #ccc;
            max-width: 800px;
            margin: 0 auto;
            direction: rtl;
            box-shadow: 0 0 15px rgba(0,0,0,0.1);
        }

        /* الهيدر */
        .paper-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .paper-logo img { height: 85px; object-fit: contain; }
        
        .paper-title { text-align: center; flex: 1; padding-top: 10px; }
        .paper-title h2 { margin: 0; font-size: 24px; font-weight: 700; color: #000; }
        .paper-title p { margin: 5px 0 0; font-size: 16px; color: #555; }
        
        .paper-meta { font-size: 14px; font-weight: 600; line-height: 1.8; text-align: left; }

        /* صفوف البيانات */
        .form-section-title {
            background: #f1f5f9;
            padding: 8px 15px;
            font-size: 16px;
            font-weight: 700;
            border-right: 4px solid #014366;
            margin-bottom: 15px;
            margin-top: 20px;
            color: #333;
            /* للتأكد من ظهور الخلفية في الطباعة */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .form-row-print {
            display: flex;
            gap: 20px;
            margin-bottom: 15px;
        }
        .form-line {
            display: flex;
            align-items: center;
            font-size: 16px; /* حجم خط مريح ومقروء */
            width: 100%;
        }
        .form-label {
            font-weight: 700;
            white-space: nowrap;
            margin-left: 10px;
            color: #444;
            min-width: fit-content;
        }
        .form-value {
            flex-grow: 1;
            border-bottom: 1px dashed #999; /* خط منقط أنيق */
            padding: 2px 10px;
            font-weight: 600;
            color: #000;
        }

        /* مربع الملاحظات */
        .reason-box {
            border: 1px solid #ccc;
            padding: 15px;
            min-height: 80px;
            background: #fafafa;
            font-size: 15px;
            border-radius: 4px;
        }

        /* التوقيعات */
        .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 50px;
            padding-top: 20px;
        }
        .sig-block {
            text-align: center;
            width: 30%;
        }
        .sig-title { font-weight: 700; margin-bottom: 40px; font-size: 16px; }
        .sig-line {
            border-top: 1px solid #000;
            padding-top: 8px;
            font-size: 16px;
            font-weight: 600;
        }

        /* 🛑 إصلاح الطباعة الجذري */
        @media print {
            body { 
                visibility: hidden; 
                background: white;
            }
            .modal-overlay {
                background: white !important;
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
            }
            .modal-header, .modal-footer, .modal-close-icon {
                display: none !important;
            }
            .modal-content {
                box-shadow: none !important;
                border: none !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                position: absolute;
                top: 0;
                left: 0;
            }
            .modal-body {
                padding: 0 !important;
                overflow: visible !important;
                background: white !important;
            }
            .official-paper {
                box-shadow: none !important;
                border: none !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                visibility: visible;
            }
            /* إجبار إظهار كل محتويات الورقة */
            .official-paper * {
                visibility: visible;
            }
        }
      </style>

      <div class="modal-header" style="background: #1e293b; color: white; display: flex; justify-content: space-between; align-items: center; padding: 12px 20px;">
          <h3 style="margin:0; font-family:'Cairo', sans-serif;">نموذج الطلب الرسمي</h3>
          <button onclick="closeModal()" class="modal-close-icon"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div class="modal-body" style="background: #f1f5f9; padding: 30px; overflow-y: auto;">
        
        <div id="printableArea" class="official-paper">
            
            <div class="paper-header">
                <div class="paper-meta">
                    <div>رقم الطلب: <b>#${id}</b></div>
                    <div style="direction:ltr; text-align:right">Date: <b>${formatDate(createdAt)}</b></div>
                </div>
                
                <div class="paper-title">
                    <h2>استمارة طلب إجازة</h2>
                    <p>Leave Request Form</p>
                </div>

                <div class="paper-logo">
                    <img src="../../Assets/شعار_جامعة_الغردقة.png" alt="Logo"> 
                </div>
            </div>

            <div class="form-section-title">بيانات الموظف</div>
            
            <div class="form-row-print">
                <div class="form-line">
                    <span class="form-label">الاسم رباعي:</span>
                    <span class="form-value">${esc(employeeName)}</span>
                </div>
            </div>

            <div class="form-row-print">
                 <div class="form-line">
                    <span class="form-label">المسمى الوظيفي:</span>
                    <span class="form-value">${esc(jobTitle)}</span>
                </div>
                 <div class="form-line">
                    <span class="form-label">جهة العمل:</span>
                    <span class="form-value">${esc(collegeName)} / ${esc(deptName)}</span>
                </div>
            </div>
            
            <div class="form-section-title">تفاصيل الإجازة</div>

            <div class="form-row-print">
                <div class="form-line">
                    <span class="form-label">نوع الإجازة:</span>
                    <span class="form-value" style="font-weight:bold;">${esc(leaveType)}</span>
                </div>
            </div>

            <div class="form-row-print">
                <div class="form-line">
                    <span class="form-label">تاريخ البداية:</span>
                    <span class="form-value">${esc(formatDate(from))}</span>
                </div>
                <div class="form-line">
                    <span class="form-label">تاريخ النهاية:</span>
                    <span class="form-value">${esc(formatDate(to))}</span>
                </div>
                <div class="form-line" style="width: 200px; flex: none;">
                    <span class="form-label">المدة:</span>
                    <span class="form-value">${esc(duration)}</span>
                </div>
            </div>

            <div class="form-section-title">السبب / الملاحظات</div>
            <div class="reason-box">
                ${esc(reason)}
            </div>

            <div class="signatures">
                <div class="sig-block">
                    <div class="sig-title">توقيع الموظف</div>
                    <div style="height: 30px;"></div> 
                    <div class="sig-line">${esc(employeeName)}</div>
                </div>
                
                <div class="sig-block">
                    <div class="sig-title">الاعتمادات</div>
                    <div style="font-size: 14px; color: ${req.status === "Approved" ? "#15803d" : "#64748b"}; margin-bottom: 5px;">
                        ${status}
                    </div>
                    <div class="sig-line">${esc(managerName)}</div>
                </div>
            </div>

            <div style="margin-top: 40px; font-size: 12px; text-align: center; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                تحريراً من النظام الإلكتروني - جامعة الغردقة
            </div>

        </div>
      </div>

      <div class="modal-footer" style="padding: 15px 20px; background: white; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px;">
        <button onclick="window.print()" class="btn primary" style="background: #1e293b; color: white; display: flex; align-items: center; gap: 8px; font-family:'Cairo';">
            <i class="fa-solid fa-print"></i> طباعة النموذج
        </button>
        <button onclick="closeModal()" class="btn" style="background: white; border: 1px solid #ccc; font-family:'Cairo';">إغلاق</button>
      </div>
    `);
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
      // Redirect to the main login/index page
      window.location.replace("../../index.html");
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
      `,
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
        1,
      );
      setStatBar("#barUsers", ((state.users.length || 0) / maxStat) * 100);
      setStatBar(
        "#barColleges",
        ((state.colleges.length || 0) / maxStat) * 100,
      );
      setStatBar(
        "#barDepartments",
        ((state.departments.length || 0) / maxStat) * 100,
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
                    id,
                  )}">تعديل</button>
                  <button class="btn danger" data-action="del" data-id="${esc(
                    id,
                  )}">حذف</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      tb.querySelectorAll("button[data-action='edit']").forEach((b) => {
        b.addEventListener("click", () =>
          showUserForm("edit", b.getAttribute("data-id")),
        );
      });
      tb.querySelectorAll("button[data-action='del']").forEach((b) => {
        b.addEventListener("click", () =>
          deleteUser(b.getAttribute("data-id")),
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

    // Role options array
    const roleOptions = [
      { value: "Employee", label: arRole("Employee") },
      { value: "Manager", label: arRole("Manager") },
      { value: "Dean", label: arRole("Dean") },
      { value: "President", label: arRole("President") },
      { value: "HR_Admin", label: arRole("HR_Admin") },
    ];

    const typeOptions = [
      { value: "Academic", label: arUserType("Academic") },
      { value: "Administrative", label: arUserType("Administrative") },
      { value: "Service", label: "خدمات معاونة" },
    ];

    openModal(`
      <div class="modal-header" style="background: linear-gradient(135deg, #014366, #0F93B4); color: white; display: flex; justify-content: space-between; align-items: center; padding: 15px 20px;">
          <h3 style="margin: 0; font-size: 18px;">${
            isEdit ? "تعديل بيانات المستخدم" : "إضافة مستخدم جديد"
          }</h3>
          <button onclick="closeModal()" class="modal-close-icon">
              <i class="fa-solid fa-xmark"></i>
          </button>
      </div>

      <div class="modal-body" style="padding: 20px;">
          <form id="addUserForm" class="user-form-grid">
              
              <div class="form-row">
                  <div class="form-group">
                      <label>الاسم ثلاثي <span style="color:red">*</span></label>
                      <input type="text" id="name" class="form-control" placeholder="اسم الموظف" value="${esc(
                        user?.name || user?.full_name || "",
                      )}" required />
                  </div>
                  <div class="form-group">
                      <label>البريد الإلكتروني <span style="color:red">*</span></label>
                      <input type="email" id="email" class="form-control" placeholder="example@univ.edu" value="${esc(
                        user?.email || "",
                      )}" ${isEdit ? "disabled" : ""} required />
                  </div>
              </div>

              <div class="form-row">
                  <div class="form-group">
                      <label>الرقم القومي (SSN) <span style="color:red">*</span></label>
                      <input type="text" id="ssn" class="form-control" placeholder="14 رقم" maxlength="14" value="${esc(
                        user?.ssn || "",
                      )}" ${isEdit ? "disabled" : ""} required />
                  </div>
                  <div class="form-group">
                      <label>النوع</label>
                      <select id="gender" class="form-control">
                          <option value="Male" ${
                            user?.gender === "Male" ? "selected" : ""
                          }>ذكر</option>
                          <option value="Female" ${
                            user?.gender === "Female" ? "selected" : ""
                          }>أنثى</option>
                      </select>
                  </div>
              </div>

              <div class="form-row">
                  <div class="form-group">
                      <label>المسمى الوظيفي</label>
                      <input type="text" id="job_title" class="form-control" placeholder="مثال: مدرس، إداري..." value="${esc(
                        user?.job_title || "",
                      )}" />
                  </div>
                  <div class="form-group">
                      <label>جهة العمل</label>
                      <input type="text" id="workplace" class="form-control" placeholder="مثال: كلية الحاسبات" value="${esc(
                        user?.workplace || "",
                      )}" />
                  </div>
              </div>

              <div class="form-row">
                  <div class="form-group">
                      <label>تاريخ التعيين</label>
                      <input type="date" id="hire_date" class="form-control" value="${
                        user?.hire_date || ""
                      }" />
                  </div>
                  <div class="form-group">
                      <label>تاريخ الميلاد</label>
                      <input type="date" id="date_of_birth" class="form-control" value="${
                        user?.date_of_birth || ""
                      }" />
                  </div>
              </div>

              <div class="form-row">
                  <div class="form-group">
                      <label>الصلاحية (Role)</label>
                      <select id="role" class="form-control">
                          ${roleOptions
                            .map(
                              (r) =>
                                `<option value="${r.value}" ${
                                  String(user?.role || "Employee") === r.value
                                    ? "selected"
                                    : ""
                                }>${r.label}</option>`,
                            )
                            .join("")}
                      </select>
                  </div>
                  <div class="form-group">
                      <label>نوع الكادر (User Type)</label>
                      <select id="user_type" class="form-control">
                          ${typeOptions
                            .map(
                              (t) =>
                                `<option value="${t.value}" ${
                                  String(user?.user_type || "Academic") ===
                                  t.value
                                    ? "selected"
                                    : ""
                                }>${t.label}</option>`,
                            )
                            .join("")}
                      </select>
                  </div>
              </div>

              <div class="form-row">
                  <div class="form-group">
                      <label>الكلية</label>
                      <select id="college_id" class="form-control">
                          ${collegeOptions(user?.college_id)}
                      </select>
                  </div>
                  <div class="form-group">
                      <label>القسم</label>
                      <select id="department_id" class="form-control">
                          <option value="">-- اختر الكلية أولاً --</option>
                      </select>
                  </div>
              </div>

             

          </form>
      </div>

      <div class="modal-footer" style="padding: 15px 20px; background: #f8fafc; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px;">
          <button id="uSave" class="btn primary" style="background-color: #014366; color: white;">${
            isEdit ? "حفظ التعديلات" : "إضافة المستخدم"
          }</button>
          <button onclick="closeModal()" class="btn" style="background: white; border: 1px solid #ccc;">إلغاء</button>
      </div>
    `);

    // 🟢 CASCADING LOGIC STARTS HERE
    const colSel = document.getElementById("college_id");
    const depSel = document.getElementById("department_id");

    const populateDepartments = (targetDeptId = null) => {
      const selectedColId = colSel.value;

      // Filter departments that belong to the selected college
      // Convert to String to avoid type mismatch (e.g. "5" vs 5)
      const filteredDeps = state.departments.filter(
        (d) => String(d.college_id) === String(selectedColId),
      );

      let html = '<option value="">-- اختر القسم --</option>';

      if (filteredDeps.length === 0 && selectedColId) {
        html = '<option value="">-- لا توجد أقسام لهذه الكلية --</option>';
      } else if (!selectedColId) {
        html = '<option value="">-- اختر الكلية أولاً --</option>';
      }

      filteredDeps.forEach((d) => {
        const dId = getId(d);
        const dName = d.department_name || d.name;
        // Select if it matches the target (user's existing dept)
        const isSelected = targetDeptId && String(dId) === String(targetDeptId);
        html += `<option value="${dId}" ${isSelected ? "selected" : ""}>${esc(dName)}</option>`;
      });

      depSel.innerHTML = html;
    };

    // 1. Trigger on load (to fill department if Editing)
    populateDepartments(user?.department_id);

    // 2. Trigger on College Change
    colSel.addEventListener("change", () => {
      populateDepartments(null); // Pass null so it doesn't auto-select old department
    });
    // 🟢 CASCADING LOGIC ENDS HERE

    // Wire up save button
    $("#uSave")?.addEventListener("click", async () => {
      const body = {
        name: $("#name")?.value?.trim(),
        email: $("#email")?.value?.trim(),
        ssn: $("#ssn")?.value?.trim(),
        gender: $("#gender")?.value,
        job_title: $("#job_title")?.value?.trim(),
        workplace: $("#workplace")?.value?.trim(),
        hire_date: $("#hire_date")?.value,
        date_of_birth: $("#date_of_birth")?.value,
        role: $("#role")?.value,
        user_type: $("#user_type")?.value,
        college_id: $("#college_id")?.value
          ? Number($("#college_id").value)
          : null,
        department_id: $("#department_id")?.value
          ? Number($("#department_id").value)
          : null,
      };

      try {
        if (!body.name) return toast("تنبيه", "الاسم مطلوب", "warn");
        if (!isEdit && !body.email)
          return toast("تنبيه", "البريد مطلوب", "warn");
        if (!isEdit && !body.ssn)
          return toast("تنبيه", "الرقم القومي مطلوب", "warn");

        setLoading(true, "جاري الحفظ...");

        if (isEdit) {
          await apiFetch(`/api/admin/users/${id}`, { method: "PUT", body });
          toast("تم", "تم تحديث المستخدم بنجاح", "success");
        } else {
          const pass = $("#password")?.value?.trim();
          if (pass) body.password = pass;
          await apiFetch(`/api/admin/users`, { method: "POST", body });
          toast("تم", "تم إضافة المستخدم بنجاح", "success");
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
      toast("تم", "تم حذف المستخدم بنجاح", "success");
      await loadUsers();
      await loadDashboard();
    });
  }

  // ---------- Colleges ----------
  // ---------- Colleges ----------
  async function loadColleges() {
    const tb = $("#collegesBody");
    if (!tb) return;

    tb.innerHTML = `<tr><td colspan="4" class="muted">جاري التحميل...</td></tr>`;

    try {
      setLoading(true, "جاري تحميل الكليات...");

      // 1. Fetch Colleges AND Ensure Users are loaded (for Dean Name)
      const [res] = await Promise.all([
        apiFetch("/api/admin/colleges"),
        ensureUsersLoaded(),
      ]);

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

          // 🟢 FIX: Find Dean Name from User List
          const deanId = c.dean_user_id ?? c.deanUserId;
          const deanUser = state.users.find(
            (u) => String(getId(u)) === String(deanId),
          );
          const deanName = deanUser ? deanUser.name || deanUser.full_name : "—";

          return `
            <tr>
              <td>${esc(id)}</td>
              <td>${esc(name)}</td>
              <td>${esc(deanName)}</td> <td>
                <div class="row" style="gap:8px; flex-wrap:wrap">
                  <button class="btn" data-action="edit" data-id="${esc(id)}">تعديل</button>
                  <button class="btn danger" data-action="del" data-id="${esc(id)}">حذف</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      tb.querySelectorAll("button[data-action='edit']").forEach((b) => {
        b.addEventListener("click", () =>
          showCollegeForm("edit", b.getAttribute("data-id")),
        );
      });
      tb.querySelectorAll("button[data-action='del']").forEach((b) => {
        b.addEventListener("click", () =>
          deleteCollege(b.getAttribute("data-id")),
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
              col?.college_name || col?.name || "",
            )}" />
          </div>
          <div style="flex:1; min-width:260px">
            <div class="muted">معرّف العميد (اختياري)</div>
            <input class="input" id="cDean" value="${esc(
              col?.dean_user_id ?? "",
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
            body: { college_name, dean_user_id },
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
  // ---------- Departments ----------
  async function loadDepartments() {
    const tb = $("#depsBody");
    if (!tb) return;

    tb.innerHTML = `<tr><td colspan="5" class="muted">جاري التحميل...</td></tr>`;

    try {
      setLoading(true, "جاري تحميل الأقسام...");

      // 1. Fetch Departments AND Ensure Reference Data (Users + Colleges) is loaded
      const [res] = await Promise.all([
        apiFetch("/api/admin/departments"),
        ensureUsersLoaded(),
        ensureCollegesLoaded(),
      ]);

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

          // 🟢 FIX: Find College Name
          const collegeId = d.college_id ?? d.college?.id;
          const colObj = state.colleges.find(
            (c) => String(getId(c)) === String(collegeId),
          );
          const collegeName = colObj ? colObj.college_name || colObj.name : "—";

          // 🟢 FIX: Find Head of Dept Name
          const headId = d.head_user_id ?? d.headUserId;
          const headUser = state.users.find(
            (u) => String(getId(u)) === String(headId),
          );
          const headName = headUser ? headUser.name || headUser.full_name : "—";

          return `
            <tr>
              <td>${esc(id)}</td>
              <td>${esc(name)}</td>
              <td>${esc(collegeName)}</td> <td>${esc(headName)}</td>    <td>
                <div class="row" style="gap:8px; flex-wrap:wrap">
                  <button class="btn" data-action="edit" data-id="${esc(id)}">تعديل</button>
                  <button class="btn danger" data-action="del" data-id="${esc(id)}">حذف</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      tb.querySelectorAll("button[data-action='edit']").forEach((b) => {
        b.addEventListener("click", () =>
          showDepartmentForm("edit", b.getAttribute("data-id")),
        );
      });
      tb.querySelectorAll("button[data-action='del']").forEach((b) => {
        b.addEventListener("click", () =>
          deleteDepartment(b.getAttribute("data-id")),
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
              dep?.department_name || dep?.name || "",
            )}" ${isEdit ? "disabled" : ""}/>
          </div>

          <div style="flex:1; min-width:260px">
            <div class="muted">الكلية</div>
            <select class="input" id="dCollege">${collegeOptions(
              dep?.college_id,
            )}</select>
          </div>
        </div>

        <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px">
          <div style="flex:1; min-width:260px">
            <div class="muted">معرّف رئيس القسم</div>
            <input class="input" id="dHead" value="${esc(
              dep?.head_user_id ?? "",
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
            body: { head_user_id, college_id },
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

  // 1. Load Data
  // ============================================================
  //  بداية قسم إدارة أنواع الإجازات (تصميم كلاسيكي - 9 أعمدة)
  // ============================================================

  // 1. دالة التحميل (تم تعديل colspan ليصبح 8)
  async function loadLeaveTypes() {
    const tb = $("#typesBody");
    if (!tb) return;

    // 🟢 تعديل: colspan أصبح 8 بدلاً من 9
    tb.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center; padding:20px;">جاري تحميل البيانات...</td></tr>`;

    try {
      setLoading(true);
      const res = await apiFetch("/api/admin/leave-types");
      const { items } = parseListResponse(res);
      state.leaveTypes = items;

      renderLeaveTypesTable(items);
    } catch (e) {
      console.error(e);
      // 🟢 تعديل: colspan أصبح 8
      tb.innerHTML = `<tr><td colspan="8" class="muted error">فشل تحميل البيانات</td></tr>`;
      toast("خطأ", e?.message || "فشل التحميل", "error");
    } finally {
      setLoading(false);
    }
  }

  // 2. دالة الرسم (تم حذف عمود المعرف)
  function renderLeaveTypesTable(items) {
    const tb = $("#typesBody");
    if (!tb) return;

    const search = ($("#typesSearch")?.value || "").trim().toLowerCase();

    const filtered = items.filter((t) => {
      if (!search) return true;
      const name = String(t.type_name || t.name || "").toLowerCase();
      const cat = String(t.category || "").toLowerCase();
      return name.includes(search) || cat.includes(search);
    });

    if (!filtered.length) {
      // 🟢 تعديل: colspan أصبح 8
      tb.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center;">لا توجد بيانات مطابقة</td></tr>`;
      return;
    }

    tb.innerHTML = filtered
      .map((t) => {
        const id = getId(t);
        const name = t.type_name || t.name || "—";
        const category = t.category || "—";

        const balanceTypeRaw = t.balance_type || "—";
        const balanceAr = arBalanceType(balanceTypeRaw);
        const fixedVal = t.fixed_balance || 0;
        const balanceDisplay =
          balanceTypeRaw === "fixed" ? `${balanceAr} (${fixedVal})` : balanceAr;

        const docsText = t.requires_document ? "نعم" : "لا";
        const genderText = arGender(t.gender_policy || "All");
        const maxDays = t.max_days_per_request ? t.max_days_per_request : "—";

        return `
        <tr>
          <td>${esc(name)}</td>
          <td>${esc(category)}</td>
          <td>${esc(balanceDisplay)}</td>
          <td>${esc(fixedVal)}</td>
          <td>${esc(docsText)}</td>
          <td>${esc(genderText)}</td>
          <td>${esc(maxDays)}</td>
          <td>
            <div class="row" style="gap:8px; justify-content:center;">
              <button class="btn" style="padding:6px 12px; font-size:13px;" data-action="edit" data-id="${id}">تعديل</button>
              <button class="btn danger" style="padding:6px 12px; font-size:13px;" data-action="del" data-id="${id}">حذف</button>
            </div>
          </td>
        </tr>
      `;
      })
      .join("");

    tb.querySelectorAll("button[data-action='edit']").forEach((b) => {
      b.addEventListener("click", () =>
        showLeaveTypeForm("edit", b.getAttribute("data-id")),
      );
    });

    tb.querySelectorAll("button[data-action='del']").forEach((b) => {
      b.addEventListener("click", () => {
        if (confirm("هل أنت متأكد من الحذف؟")) {
          toast("تنبيه", "تم طلب الحذف", "info");
        }
      });
    });
  }
  // 3. Helpers for Documents
  function docsToTextarea(required_documents) {
    if (!Array.isArray(required_documents)) return "";
    return required_documents
      .map((d) =>
        `${d.is_mandatory ? "* " : ""}${d.document_name || d.name || ""}`.trim(),
      )
      .join("\n");
  }

  function textareaToDocs(text) {
    return String(text || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const mandatory = l.startsWith("*");
        const name = l.replace(/^\*\s*/, "").trim();
        return { document_name: name, is_mandatory: mandatory };
      });
  }

  // 4. THE MAIN FORM MODAL (Add/Edit)
// 4. THE MAIN FORM MODAL (Add/Edit) - Updated with Legal Forms Checkboxes
  async function showLeaveTypeForm(mode, id) {
    const isEdit = mode === "edit";
    let t = null;

    // Fetch fresh data if editing
    if (isEdit) {
      try {
        t = state.leaveTypes.find((x) => String(getId(x)) === String(id));
        const res = await apiFetch(`/api/admin/leave-types/${id}`);
        const data = unwrap(res);
        if (data) t = data.leave_type || data;
      } catch (e) {
        console.warn("Using local state fallback");
      }
    }

    // Helper to safely get value
    const val = (p, alt) => t?.[p] ?? t?.[alt] ?? "";

    // Workflow State
    let workflowSteps = [];

    // Static Options
    const approverRoles = [
      { value: "Head_of_Department", label: "رئيس القسم" },
      { value: "Dean", label: "العميد" },
      { value: "HR_Admin", label: "الموارد البشرية" },
      { value: "Manager", label: "المدير المباشر" },
      { value: "President", label: "رئيس الجامعة" },
    ];

    // 🟢 NEW LOGIC: Check for specific legal documents
    const docs = t?.required_documents || [];
    const hasTravelDoc = docs.some(d => d.document_name.includes("عدم السفر"));
    const hasWorkDoc = docs.some(d => d.document_name.includes("عدم العمل"));
    
    // Filter out special docs so they don't appear in the text area
    const customDocs = docs.filter(d => !d.document_name.includes("عدم السفر") && !d.document_name.includes("عدم العمل"));

    openFancyModal({
      title: isEdit ? "تعديل نوع إجازة" : "إضافة نوع إجازة",
      subtitle: "إدارة السياسات، الرصيد، ومسار الموافقات",
      iconHtml: `<i class="fa-solid fa-list-check"></i>`,
      bodyHtml: `
        <div class="user-form-grid">
           <div class="form-row">
             <div class="form-group full-width">
               <label>اسم الإجازة <span style="color:red">*</span></label>
               <input class="form-control" id="ltName" value="${esc(val("type_name", "name"))}" placeholder="مثال: إجازة اعتيادية" />
             </div>
           </div>
           
           <div class="form-row">
             <div class="form-group full-width">
               <label>الوصف</label>
               <textarea class="form-control" id="ltDesc" rows="2">${esc(val("description"))}</textarea>
             </div>
           </div>

           <div class="form-row">
             <div class="form-group">
               <label>الفئة</label>
               <input class="form-control" id="ltCat" value="${esc(val("category"))}" placeholder="مثال: سنوية" />
             </div>
             <div class="form-group">
               <label>الجنس المسموح</label>
               <select class="form-control" id="ltGender">
                  <option value="All" ${val("gender_policy") === "All" ? "selected" : ""}>الجميع</option>
                  <option value="Male" ${val("gender_policy") === "Male" ? "selected" : ""}>ذكور فقط</option>
                  <option value="Female" ${val("gender_policy") === "Female" ? "selected" : ""}>إناث فقط</option>
               </select>
             </div>
           </div>

           <div class="form-section-title">الرصيد والحساب</div>
           
           <div class="form-row">
             <div class="form-group">
                <label>نوع الرصيد</label>
                <select class="form-control" id="ltBalType">
                   <option value="fixed" ${val("balance_type") === "fixed" ? "selected" : ""}>رصيد ثابت</option>
                   <option value="calculated" ${val("balance_type") === "calculated" ? "selected" : ""}>محسوب (قانون العمل)</option>
                </select>
             </div>
             <div class="form-group">
                <label>الرصيد الافتراضي</label>
                <input type="number" class="form-control" id="ltFixedBal" value="${val("fixed_balance") || 0}" />
             </div>
           </div>

           <div class="form-row" style="margin-top:10px;">
              <div class="form-group" style="flex-direction:row; gap:15px; align-items:center;">
                  <label class="checkbox-card" style="flex:1;">
                      <input type="checkbox" class="custom-checkbox" id="ltIsPaid" ${t?.is_paid !== false ? "checked" : ""}>
                      <span class="checkbox-label">مدفوعة الأجر (Paid)</span>
                  </label>
                  <label class="checkbox-card" style="flex:1;">
                      <input type="checkbox" class="custom-checkbox" id="ltDeduct" ${t?.deduct_from_balance !== false ? "checked" : ""}>
                      <span class="checkbox-label">تخصم من الرصيد</span>
                  </label>
              </div>
           </div>

           <div class="form-section-title">المستندات والإقرارات المطلوبة</div>

           <div class="form-row" style="background:#fff7ed; padding:15px; border-radius:8px; border:1px solid #ffedd5; margin-bottom:15px;">
              <div class="form-group full-width">
                  <label style="color:#c2410c; margin-bottom:10px; font-weight:bold;">إقرارات قانونية (يجب تحميلها وتوقيعها):</label>
                  <div style="display:flex; gap:15px; flex-wrap:wrap;">
                      <label class="checkbox-card" style="flex:1; height:auto; padding:10px; min-width:200px;">
                          <input type="checkbox" class="custom-checkbox" id="reqTravelBan" ${hasTravelDoc ? 'checked' : ''}> 
                          <span class="checkbox-label" style="font-size:13px">إقرار عدم السفر للخارج</span>
                      </label>
                      <label class="checkbox-card" style="flex:1; height:auto; padding:10px; min-width:200px;">
                          <input type="checkbox" class="custom-checkbox" id="reqNoWork" ${hasWorkDoc ? 'checked' : ''}> 
                          <span class="checkbox-label" style="font-size:13px">إقرار عدم العمل لجهة خارجية</span>
                      </label>
                  </div>
              </div>
           </div>

           <div class="form-row">
              <div class="form-group" style="flex-direction:row; gap:15px; align-items:center;">
                  <label class="checkbox-card" style="flex:1;">
                      <input type="checkbox" class="custom-checkbox" id="ltReqDoc" ${t?.requires_document ? "checked" : ""}>
                      <span class="checkbox-label">تتطلب مرفقات أخرى</span>
                  </label>
                  <label class="checkbox-card" style="flex:1;">
                      <input type="checkbox" class="custom-checkbox" id="ltReqDel" ${t?.requires_delegate ? "checked" : ""}>
                      <span class="checkbox-label">تتطلب تفويض بديل</span>
                  </label>
              </div>
           </div>

           <div class="form-group full-width">
               <label>مستندات إضافية (سطر لكل مستند)</label>
               <textarea class="form-control" id="ltDocs" rows="3" placeholder="اكتب اسم المستند في كل سطر (ابدأ بـ * للمستند الإلزامي)">${esc(docsToTextarea(customDocs))}</textarea>
           </div>

           <div class="form-section-title">القيود والشروط (اختياري)</div>
           
           <div class="form-row">
             <div class="form-group">
                <label>حد العمر (مرة)</label>
                <input type="number" class="form-control" id="ltLife" value="${val("lifetime_limit")}" placeholder="بلا حد" />
             </div>
             <div class="form-group">
                <label>سنوات خدمة مطلوبة</label>
                <input type="number" class="form-control" id="ltService" value="${val("years_of_service_required") || 0}" />
             </div>
           </div>

           <div class="form-row">
             <div class="form-group">
                <label>أقل مدة (أيام)</label>
                <input type="number" class="form-control" id="ltMinDays" value="${val("min_days_duration") || 1}" />
             </div>
             <div class="form-group">
                <label>أقصى مدة للطلب</label>
                <input type="number" class="form-control" id="ltMaxDays" value="${val("max_days_per_request")}" placeholder="مفتوح" />
             </div>
           </div>

           ${
             !isEdit
               ? `
           <div class="form-section-title">مسار الموافقة (Workflow)</div>
           <div class="workflow-box">
               <div id="workflowList" class="workflow-list"></div>
               <div class="workflow-add-row">
                   <select id="wfRoleSelector" class="form-control" style="flex:2">
                       ${approverRoles.map((r) => `<option value="${r.value}">${r.label}</option>`).join("")}
                   </select>
                   <button type="button" id="btnAddStep" class="btn" style="flex:1; background:#e0f2fe; color:#014366; border:1px solid #bae6fd;">
                       <i class="fa-solid fa-plus"></i> إضافة خطوة
                   </button>
               </div>
           </div>
           `
               : ""
           }
        </div>
      `,
      footerHtml: `
        <button class="btn" onclick="closeModal()">إلغاء</button>
        <button class="btn primary" id="ltSave">${isEdit ? "حفظ التعديلات" : "إنشاء النوع"}</button>
      `,
    });

    // --- Workflow Logic (Create Mode Only) ---
    if (!isEdit) {
      const wfListEl = document.getElementById("workflowList");
      const wfBtn = document.getElementById("btnAddStep");
      const wfSelect = document.getElementById("wfRoleSelector");

      const renderWorkflow = () => {
        if (workflowSteps.length === 0) {
          wfListEl.innerHTML = `<div style="text-align:center; color:#94a3b8; font-size:13px; padding:10px;">سيتم اعتماد المسار الافتراضي (رئيس القسم -> العميد)</div>`;
          return;
        }
        wfListEl.innerHTML = workflowSteps
          .map((step, index) => {
            const roleObj = approverRoles.find(
              (r) => r.value === step.approver_role,
            );
            return `
                    <div class="workflow-step">
                        <div class="step-info">
                            <span class="step-badge">${index + 1}</span>
                            <span>${roleObj ? roleObj.label : step.approver_role}</span>
                        </div>
                        <div class="step-remove" onclick="window.removeWfStep(${index})">
                            <i class="fa-solid fa-trash"></i>
                        </div>
                    </div>`;
          })
          .join("");
      };

      window.removeWfStep = (index) => {
        workflowSteps.splice(index, 1);
        workflowSteps.forEach((s, i) => (s.step_order = i + 1));
        renderWorkflow();
      };

      wfBtn.addEventListener("click", () => {
        workflowSteps.push({
          step_order: workflowSteps.length + 1,
          approver_role: wfSelect.value,
        });
        renderWorkflow();
      });

      renderWorkflow();
    }

    // --- Save Handler ---
    $("#ltSave").addEventListener("click", async () => {
      const name = $("#ltName").value.trim();
      if (!name) return toast("تنبيه", "اسم الإجازة مطلوب", "warn");

      // 1. تجميع المستندات (يدوية + إقرارات)
      let finalDocs = textareaToDocs($("#ltDocs").value);

      if($("#reqTravelBan")?.checked) {
          finalDocs.push({ document_name: "إقرار وتعهد بعدم السفر للخارج", is_mandatory: true });
      }
      if($("#reqNoWork")?.checked) {
          finalDocs.push({ document_name: "إقرار وتعهد بعدم العمل لجهه خارجيه", is_mandatory: true });
      }

      const body = {
        type_name: name,
        description: $("#ltDesc").value.trim(),
        category: $("#ltCat").value.trim(),
        gender_policy: $("#ltGender").value,

        balance_type: $("#ltBalType").value,
        fixed_balance: Number($("#ltFixedBal").value) || 0,

        is_paid: $("#ltIsPaid").checked,
        deduct_from_balance: $("#ltDeduct").checked,
        requires_document: $("#ltReqDoc").checked || finalDocs.length > 0, // تفعيل تلقائي لو فيه مستندات
        requires_delegate: $("#ltReqDel").checked,

        lifetime_limit: $("#ltLife").value ? Number($("#ltLife").value) : null,
        years_of_service_required: Number($("#ltService").value) || 0,
        min_days_duration: Number($("#ltMinDays").value) || 1,
        max_days_per_request: $("#ltMaxDays").value
          ? Number($("#ltMaxDays").value)
          : null,

        required_documents: finalDocs,
      };

      if (!isEdit) body.workflow = workflowSteps;

      setLoading(true);
      try {
        if (isEdit) {
          await apiFetch(`/api/admin/leave-types/${id}`, {
            method: "PUT",
            body,
          });
          toast("تم", "تم تحديث نوع الإجازة", "success");
        } else {
          await apiFetch(`/api/admin/leave-types`, { method: "POST", body });
          toast("تم", "تم إنشاء نوع الإجازة", "success");
        }
        closeModal();
        loadLeaveTypes();
      } catch (e) {
        toast("خطأ", e.message || "حدث خطأ أثناء الحفظ", "error");
      } finally {
        setLoading(false);
      }
    });
  }

  // ---------- Eligibility (Rules) ----------
  // ---------- Eligibility (Rules) ----------
  async function loadEligibility() {
    const tb = $("#rulesBody");
    if (!tb) return;

    // 🟢 تعديل: تقليل عدد الأعمدة إلى 4
    tb.innerHTML = `<tr><td colspan="4" class="muted">جاري التحميل...</td></tr>`;

    try {
      setLoading(true, "جاري تحميل الصلاحيات...");

      const [rulesRes, typesRes] = await Promise.all([
        apiFetch("/api/admin/leave-eligibility"),
        apiFetch("/api/admin/leave-types"),
      ]);

      const rules = parseListResponse(rulesRes).items;
      const types = parseListResponse(typesRes).items;

      state.eligibility = rules;
      state.leaveTypes = types;

      const typeMap = {};
      types.forEach((t) => {
        if (t.id) typeMap[String(t.id)] = t.type_name || t.name || "—";
        if (t.type_id)
          typeMap[String(t.type_id)] = t.type_name || t.name || "—";
      });

      if (!rules.length) {
        tb.innerHTML = `<tr><td colspan="4" class="muted">لا توجد بيانات</td></tr>`;
        return;
      }

      tb.innerHTML = rules
        .map((r) => {
          const ruleId = getId(r); // نحتاجه للحذف فقط
          const targetId = r.type_id ?? r.leave_type_id ?? r.leaveTypeId;
          const leaveName = typeMap[String(targetId)] || "غير معروف";
          const eligibleRaw = r.eligible_user_type || r.eligibleUserType || "—";
          const eligible = arUserType(eligibleRaw);

          return `
            <tr>
              <td style="font-family:monospace; font-weight:bold;">${esc(targetId)}</td>
              <td style="color: #014366; font-weight:bold;">${esc(leaveName)}</td>
              <td>${esc(eligible)}</td>
              <td>
                <div class="row" style="gap:8px; flex-wrap:wrap">
                  <button class="btn danger" data-action="del" data-id="${esc(ruleId)}">حذف</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      tb.querySelectorAll("button[data-action='del']").forEach((b) => {
        b.addEventListener("click", () =>
          deleteEligibilityRule(b.getAttribute("data-id")),
        );
      });
    } catch (e) {
      console.error(e);
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
            t.type_name || t.name || getId(t),
          )}</option>`,
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
                arUserType("Administrative"),
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
                  id,
                )}">تفاصيل</button>
                <button class="btn primary" data-action="override" data-id="${esc(
                  id,
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
          (x) => String(getId(x)) === String(id),
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
        showOverrideModal(b.getAttribute("data-id")),
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
        _t: Date.now(),
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
        _t: Date.now(),
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
        _t: Date.now(),
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
        ($("#repBody").innerHTML =
          `<tr><td colspan="8" class="muted">فشل التحميل</td></tr>`);
    } finally {
      setLoading(false);
    }
  }

  function showOverrideModal(requestId) {
    const statusOptions = [
      { value: "Approved", label: arStatus("Approved") },
      { value: "Rejected", label: arStatus("Rejected") },
      { value: "Cancelled", label: arStatus("Cancelled") },
    ];

    openModal(`
      <div class="modal-header" style="background: linear-gradient(135deg, #014366, #0F93B4); color: white; display: flex; justify-content: space-between; align-items: center; padding: 15px 20px;">
          <h3 style="margin: 0; font-size: 18px;">تعديل حالة الطلب رقم ${requestId}</h3>
          <button onclick="closeModal()" class="modal-close-icon">
              <i class="fa-solid fa-xmark"></i>
          </button>
      </div>

      <div class="modal-body" style="padding: 20px;">
        <div class="user-form-grid">
            <div class="form-row">
              <div class="form-group">
                <label>الحالة الجديدة</label>
                <select class="form-control" id="ovStatus">
                  ${statusOptions.map((s) => `<option value="${s.value}">${esc(s.label)}</option>`).join("")}
                </select>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group full-width">
                <label>سبب التعديل (5 أحرف على الأقل) <span style="color:red">*</span></label>
                <input class="form-control" id="ovReason" placeholder="اكتب السبب..." />
              </div>
            </div>
        </div>
      </div>

      <div class="modal-footer" style="padding: 15px 20px; background: #f8fafc; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px;">
        <button class="btn primary" id="ovSave" style="background-color: #014366; color: white;">حفظ التعديل</button>
        <button onclick="closeModal()" class="btn" style="background: white; border: 1px solid #ccc;">إلغاء</button>
      </div>
    `);

    $("#ovSave")?.addEventListener("click", async () => {
      const newStatus = $("#ovStatus")?.value;
      const reason = $("#ovReason")?.value?.trim();

      if (!reason || reason.length < 5) {
        return toast("تنبيه", "يجب كتابة 5 أحرف على الأقل", "warn");
      }

      const payload = {
        status: newStatus,
        comments: reason,
      };

      try {
        setLoading(true, "جاري الإرسال...");

        // 🟢 استخدام apiFetch لضمان الاتصال بالسيرفر الصحيح (يضيف Base URL + Token تلقائياً)
        const res = await apiFetch(
          `/api/admin/leave-requests/${requestId}/override-status`,
          {
            method: "PUT",
            body: payload,
          },
        );

        // التحقق من رد السيرفر بشكل أعمق
        console.log("[Override Response]", res);

        const possibleStatuses = [
          "Approved",
          "Rejected",
          "Cancelled",
          "Pending",
          "Canceled",
        ];
        const findRealStatus = (obj) => {
          if (!obj) return null;
          if (typeof obj === "string" && possibleStatuses.includes(obj))
            return obj;
          if (typeof obj !== "object") return null;

          // البحث في الخصائص المباشرة
          for (const key of ["status", "current_status", "state"]) {
            const val = obj[key];
            if (val && possibleStatuses.includes(val)) return val;
          }

          // البحث في الكائنات المتداخلة
          if (obj.data) {
            const s = findRealStatus(obj.data);
            if (s) return s;
          }
          if (obj.leave_request) {
            const s = findRealStatus(obj.leave_request);
            if (s) return s;
          }
          if (obj.request) {
            const s = findRealStatus(obj.request);
            if (s) return s;
          }
          return null;
        };

        const serverStatus = findRealStatus(res);

        if (!serverStatus) {
          console.warn("Could not find status in response, using fallback.");
        }

        if (
          serverStatus &&
          String(serverStatus).toLowerCase() !== String(newStatus).toLowerCase()
        ) {
          alert(
            `تنبيه: تم طلب "${newStatus}" ولكن السيرفر أرجع "${serverStatus}". قد تكون هناك قيود تمنع هذا التعديل.`,
          );
        } else {
          toast("تم", "تم تعديل الحالة بنجاح", "success");
        }

        closeModal();

        // تحديث الجدول فوراً بالحالة الحقيقية
        const finalStatus = serverStatus || newStatus;

        const btn = document.querySelector(
          `button[data-action="override"][data-id="${requestId}"]`,
        );
        if (btn) {
          const tr = btn.closest("tr");
          const badge = tr.querySelector(".pill");
          if (badge) {
            badge.textContent = arStatus(finalStatus);
            // إضافة تأثير بصري للتأكيد
            tr.style.backgroundColor = "#dcfce7";
            setTimeout(() => (tr.style.backgroundColor = ""), 2000);
          }
        }

        // إعادة تحميل البيانات من السيرفر للتأكد 100%
        await loadReports();
      } catch (e) {
        console.error(e);
        // تجاهل أي خطأ يتعلق بـ JSON لأن العملية تكون قد تمت بالفعل
        if (e.message && e.message.includes("JSON")) {
          toast("تم", "تم التعديل بنجاح", "success");
          closeModal();
        } else {
          alert("خطأ في الاتصال: " + e.message);
        }
      } finally {
        setLoading(false);
      }
    });
  }
  function formatFileDate(d = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate(),
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
      showCollegeForm("add"),
    );
    $("#depsRefreshBtn")?.addEventListener("click", loadDepartments);
    $("#depsAddBtn")?.addEventListener("click", () =>
      showDepartmentForm("add"),
    );

    $("#typesRefreshBtn")?.addEventListener("click", loadLeaveTypes);
    $("#typesAddBtn")?.addEventListener("click", () =>
      showLeaveTypeForm("add"),
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
      loadReports({ reset: true }),
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
      wireButtons();

      renderProfile(null);

      if (getToken()) {
        await bootAfterToken();
      } else {
        setPendingBadge(0);
        toast("تنبيه", "يرجى تسجيل الدخول أولاً", "warn");
      }
    } catch (e) {
      toast("خطأ", e?.message || "فشل تشغيل الصفحة", "error");
    }
  });
})();
