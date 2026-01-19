# Leave Management System - Frontend

## Project Overview

This is the frontend repository for the University Leave Management System. It is a **Vanilla JavaScript** application (HTML/CSS/JS) designed to manage employee leave requests, approvals, and system configuration. It interacts with a backend API to perform all operations.

**Key Features:**
*   **Role-Based Portals:** Dedicated interfaces for Employees, Managers (Head of Dept/Dean), and System Admins (HR).
*   **Authentication:** JWT-based login with onboarding/account activation flows.
*   **Leave Management:** Create requests, upload documents, approval workflows (Manager -> Dean -> HR), and status tracking.
*   **Admin Control:** Manage users, colleges, departments, and leave types.
*   **Reporting:** Visual dashboards and Excel export capabilities.

## Architecture & Structure

The project is structured as a static site with no build process required.

```
D:\college\Level 4\Graduation project\my front\Frontend\
├── index.html              # Main Entry Point (Login Page)
├── login.js / login.css    # Login logic and styling
├── Assets/                 # Static images and logos
└── leave-portal/           # Main Application Logic
    ├── common.js           # Core utilities (API wrapper, Helpers, Config)
    ├── styles.css          # Shared global styles
    ├── Admin/              # HR/Admin Portal
    │   ├── hr.html
    │   ├── hr.js           # Admin logic (Users, Orgs, Reports)
    │   └── hr.css
    ├── employee/           # Employee Portal
    │   ├── employee.html
    │   ├── employee.js     # Leave request creation & history
    │   └── employee.css
    ├── manager/            # Manager/Dean Portal
    │   ├── manager.html
    │   ├── manager.js      # Approval workflows
    │   └── manager.css
    └── onboarding/         # Account activation flow
        └── ...
```

## Key Configuration

*   **API Base URL:** Defined in `leave-portal/common.js` under `CONFIG.API_BASE`.
    *   Current: `https://leave-system-1af0.onrender.com`
*   **Token Storage:** JWT is stored in `localStorage` under the key `ulm_jwt_token`.

## Development Conventions

*   **Tech Stack:** Native HTML5, CSS3, ES6+ JavaScript. No frameworks (React/Vue) or bundlers (Webpack/Vite) are used.
*   **API Interactions:**
    *   ALWAYS use the `apiFetch` function from `common.js` instead of native `fetch`. It handles:
        *   Base URL prepending.
        *   Authorization header injection (`Bearer <token>`).
        *   JSON body parsing and error handling.
*   **UI Components:**
    *   **Toasts:** Use `toast(title, message, type)` for notifications.
    *   **Modals:** Use `openModal(html)` and `closeModal()` helpers.
    *   **DOM Access:** Use `qs(selector)` (querySelector) and `qsa(selector)` (querySelectorAll) helpers.
*   **Role Management:**
    *   Roles are strictly defined as: `Admin`, `HR_Admin`, `Manager`, `Dean`, `President`, `Head_of_Department`, `Employee`.
    *   Redirection logic resides in `login.js` and `onboarding.js`.

## Running the Project

Since this is a static site, you do not need to install dependencies or run a build server.

1.  **Local Development:**
    *   Simply open `index.html` in a web browser.
    *   For a better experience (to avoid CORS issues with file protocol), use a local static server like Live Server (VS Code extension) or Python:
        ```bash
        # Python 3
        python -m http.server 8000
        # Then visit http://localhost:8000
        ```

2.  **Deployment:**
    *   Upload the entire directory to any static hosting provider (GitHub Pages, Netlify, Vercel, or an S3 bucket).

## dependencies
*   **Font Awesome:** Loaded via CDN in HTML files.
*   **SheetJS (xlsx):** Loaded via CDN for Excel export functionality.
