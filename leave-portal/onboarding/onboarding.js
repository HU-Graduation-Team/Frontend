const API_BASE = "https://leave-system-1af0.onrender.com";
const loginPage = "../login/login.html";
const adminPage = "../admin/hr.html";
const managerPage = "../manager/manager.html";
const employeePage = "../employee/employee.html";

/* ===============================
   🔐 حماية الصفحة (TEMP TOKEN فقط)
================================ */
const token = localStorage.getItem("ulm_jwt_token");
if (!token) {
  window.location.replace(loginPage);
}

/* ===============================
   👁️ Toggle Password
================================ */
function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}

/* ===============================
   📝 Form Submit
================================ */
const form = document.getElementById("profileForm");
const submitBtn = document.getElementById("submitBtn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const phone = document.getElementById("mobile").value.trim();
  const newPassword = document.getElementById("password").value.trim();
  const confirmPassword = document
    .getElementById("confirmPassword")
    .value.trim();

  // -------- Validation --------
  if (!phone || !newPassword || !confirmPassword) {
    alert("من فضلك أدخل جميع البيانات المطلوبة");
    return;
  }

  if (newPassword !== confirmPassword) {
    alert("كلمة المرور وتأكيدها غير متطابقين");
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = "جاري التفعيل...";

    const response = await fetch(`${API_BASE}/api/auth/complete-onboarding`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        phone,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data?.message || "فشل تفعيل الحساب");
      return;
    }

    alert("✅ تم تفعيل الحساب بنجاح، من فضلك قم بتسجيل الدخول");

    // 🔥 مهم جدًا
    localStorage.removeItem("ulm_jwt_token");

    // 🔁 رجوع إجباري للـ login
    window.location.replace(loginPage);
  } catch (error) {
    console.error(error);
    alert("⚠️ خطأ في الاتصال بالسيرفر");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "تحديث البيانات";
  }
});
