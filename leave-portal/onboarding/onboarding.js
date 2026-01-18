const API_BASE = "https://leave-system-1af0.onrender.com";
const loginPage = "../../index.html";
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

    const result = data.data || data; // التعامل مع احتمالية وجود wrapper

    alert("✅ تم تفعيل الحساب بنجاح!");

    // التحقق من وجود التوكن الجديد والدور لإعادة التوجيه مباشرة
    if (result && result.token && result.user && result.user.role) {
        localStorage.setItem("ulm_jwt_token", result.token);
        
        const role = result.user.role;
        if (role === "HR_Admin" || role === "Admin") {
            window.location.replace(adminPage);
        } else if (["Manager", "Dean", "President", "Head_of_Department"].includes(role)) {
            window.location.replace(managerPage);
        } else {
            window.location.replace(employeePage);
        }
    } else {
        // إذا لم يرجع السيرفر التوكن الجديد، نعود لصفحة الدخول
        localStorage.removeItem("ulm_jwt_token");
        window.location.replace(loginPage);
    }
  } catch (error) {
    console.error(error);
    alert("⚠️ خطأ في الاتصال بالسيرفر");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "تحديث البيانات";
  }
});
