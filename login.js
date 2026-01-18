const API_BASE = "https://leave-system-1af0.onrender.com";
const completeOnboardingPage =
  "leave-portal/onboarding/complete-onboarding.html";
const adminPage = "leave-portal/admin/hr.html";
const managerPage = "leave-portal/manager/manager.html";
const employeePage = "leave-portal/employee/employee.html";

// 🟢 فتح وغلق الـ login box
function openLogin() {
  const logo = document.getElementById("logo");
  const banner = document.getElementById("banner");
  const loginBox = document.getElementById("loginBox");
  const backBtn = document.getElementById("backBtn");

  logo.style.top = "20px";
  logo.style.transform = "scale(0.8)";

  banner.style.opacity = "0";
  banner.style.pointerEvents = "none";

  loginBox.classList.add("show");
  backBtn.style.display = "block";
}

function closeLogin() {
  const logo = document.getElementById("logo");
  const banner = document.getElementById("banner");
  const loginBox = document.getElementById("loginBox");
  const backBtn = document.getElementById("backBtn");

  logo.style.top = "50%";
  logo.style.transform = "translateY(-50%) scale(1)";

  banner.style.opacity = "1";
  banner.style.pointerEvents = "auto";

  loginBox.classList.remove("show");
  backBtn.style.display = "none";
}

// 🟢 العين
function togglePassword(inputId) {
  const passwordInput = document.getElementById(inputId);
  const type =
    passwordInput.getAttribute("type") === "password" ? "text" : "password";
  passwordInput.setAttribute("type", type);
}

// 🟢 زر الدخول + ربط الـ API
document
  .getElementById("loginForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    // console.log("Email:", email);
    // console.log("Password:", password);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password }),
      });

      const result = await response.json();
      console.log("Server response:", result);

      if (!response.ok) {
        alert(result.message || "❌ بيانات الدخول غير صحيحة");
        return;
      }

      // حفظ التوكن والدور
      localStorage.setItem("ulm_jwt_token", result.data.token);
      localStorage.setItem("role", result.data.user.role);

      // تحويل حسب حالة المستخدم
      if (result.data.status === "activation_required") {
        window.location.href = completeOnboardingPage;
      } else {
        redirectByRole(result.data.user.role);
      }
    } catch (error) {
      console.error(error);
      alert("⚠️ خطأ في الاتصال بالسيرفر");
    }
  });

// 🟢 تحويل حسب الدور
function redirectByRole(role) {
  if (role === "Employee") {
    window.location.href = employeePage;
  } else if (role === "Manager" || role === "Dean" || role === "President") {
    window.location.href = managerPage;
  } else if (role === "HR_Admin") {
    window.location.href = adminPage;
  } else {
    window.location.href = "login.html";
  }
}
