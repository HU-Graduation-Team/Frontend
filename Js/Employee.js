document.addEventListener('DOMContentLoaded', function () {
    // Mock Data
    let requests = [
        { type: 'إجازة سنوية', dates: 'Dec 20, 2024 - Dec 27, 2024', duration: '8 أيام', status: 'pending', approver: 'Dr. Robert Chen' },
        { type: 'إجازة مرضية', dates: 'Nov 15, 2024 - Nov 16, 2024', duration: '2 أيام', status: 'approved', approver: 'Dr. Sarah Williams' },
        { type: 'إجازة شخصية', dates: 'Nov 8, 2024', duration: '1 يوم', status: 'approved', approver: 'Dr. Sarah Williams' },
        { type: 'إجازة سنوية', dates: 'Oct 30, 2024 - Nov 1, 2024', duration: '3 أيام', status: 'rejected', approver: 'Dr. Robert Chen' },
        { type: 'إجازة سنوية', dates: 'Oct 12, 2024 - Oct 15, 2024', duration: '4 أيام', status: 'approved', approver: 'Dr. Sarah Williams' },
        { type: 'إجازة مرضية', dates: 'Sep 28, 2024', duration: '1 يوم', status: 'approved', approver: 'Dr. Sarah Williams' },
        { type: 'إجازة شخصية', dates: 'Dec 23, 2024 - Dec 24, 2024', duration: '2 أيام', status: 'pending', approver: 'Prof. Michael Brown' },
        { type: 'إجازة سنوية', dates: 'Aug 5, 2024 - Aug 9, 2024', duration: '5 أيام', status: 'approved', approver: 'Dr. Robert Chen' }
    ];

    const statusLabels = {
        'pending': 'قيد الانتظار',
        'approved': 'مقبول',
        'rejected': 'مرفوض'
    };
    const statusClasses = {
        'pending': 'status-pending',
        'approved': 'status-approved',
        'rejected': 'status-rejected'
    };

    const tableBody = document.getElementById('requestsTableBody');
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const typeFilter = document.getElementById('typeFilter');
    const tabAll = document.getElementById('tab-all');
    const tabPending = document.getElementById('tab-pending');

    let currentStatusFilter = 'all'; 

    function renderTable(data) {
        tableBody.innerHTML = '';
        data.sort((a, b) => new Date(b.dates.split(' - ')[0]) - new Date(a.dates.split(' - ')[0]));

        data.forEach((req) => {
            const tr = document.createElement('tr');
            const index = requests.findIndex(r => r === req);
            
            // CHANGED: Added logic to only show delete icon if status is pending
            const deleteButton = req.status === 'pending' 
                ? `<i class="bi bi-trash action-btn" onclick="deleteReq(${index})" title="حذف"></i>` 
                : ''; 

            tr.innerHTML = `
                <td>${req.type}</td>
                <td dir="ltr" class="text-end">${req.dates}</td>
                <td>${req.duration}</td>
                <td><span class="badge-status ${statusClasses[req.status]}">${statusLabels[req.status]}</span></td>
                <td>${req.approver}</td>
                <td class="text-center">
                    <i class="bi bi-eye action-btn" title="عرض"></i>
                    ${deleteButton}
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Update Counts
        const allCount = requests.length;
        const pendingCount = requests.filter(r => r.status === 'pending').length;
        tabAll.textContent = `جميع الطلبات (${allCount})`;
        tabPending.textContent = `قيد الانتظار (${pendingCount})`;
    }

    function filterData() {
        const term = searchInput.value.toLowerCase();
        const status = statusFilter.value;
        const typeVal = typeFilter.value;

        const filtered = requests.filter(req => {
            const matchesSearch = req.type.includes(term) || req.dates.toLowerCase().includes(term) || req.approver.toLowerCase().includes(term);
            const matchesStatus = status === 'all' || req.status === status;

            let matchesType = true;
            if(typeVal !== 'all') {
                if(typeVal === 'annual' && !req.type.includes('سنوية')) matchesType = false;
                if(typeVal === 'sick' && !req.type.includes('مرضية')) matchesType = false;
                if(typeVal === 'personal' && !req.type.includes('شخصية')) matchesType = false;
            }

            return matchesSearch && matchesStatus && matchesType;
        });
        renderTable(filtered);
    }

    // --- Tab/Pill Logic ---
    function activateTab(tabId) {
        tabAll.classList.remove('active');
        tabPending.classList.remove('active');

        if (tabId === 'tab-all') {
            tabAll.classList.add('active');
            statusFilter.value = 'all';
        } else if (tabId === 'tab-pending') {
            tabPending.classList.add('active');
            statusFilter.value = 'pending';
        }
        filterData();
    }

    tabAll.addEventListener('click', () => activateTab('tab-all'));
    tabPending.addEventListener('click', () => activateTab('tab-pending'));

    // Filters
    searchInput.addEventListener('input', () => {
        if (statusFilter.value !== 'pending') {
            tabAll.classList.add('active');
            tabPending.classList.remove('active');
        }
        filterData();
    });
    statusFilter.addEventListener('change', () => {
        if (statusFilter.value === 'pending') {
            tabPending.classList.add('active');
            tabAll.classList.remove('active');
        } else {
            tabAll.classList.add('active');
            tabPending.classList.remove('active');
        }
        filterData();
    });
    typeFilter.addEventListener('change', filterData);

    // Add Request Logic
    document.getElementById('leaveForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const typeVal = document.getElementById('leaveType').value;
        const fromDate = document.getElementById('startDate').value;
        const toDate = document.getElementById('endDate').value;
        const daysCount = document.getElementById('daysCount').value;

        let typeLabel = 'إجازة';
        if(typeVal === 'annual') typeLabel = 'إجازة سنوية';
        if(typeVal === 'casual') typeLabel = 'إجازة عارضة';
        if(typeVal === 'sick') typeLabel = 'إجازة مرضية';
        if(typeVal === 'maternity') typeLabel = 'إجازة أمومة/أبوة';
        if(typeVal === 'personal') typeLabel = 'إجازة شخصية';

        const formattedDates = `${new Date(fromDate).toLocaleDateString('en-US')} - ${new Date(toDate).toLocaleDateString('en-US')}`;

        requests.unshift({
            type: typeLabel,
            dates: formattedDates,
            duration: `${daysCount} أيام`,
            status: 'pending',
            approver: 'مدير مباشر'
        });

        const modalEl = document.getElementById('requestModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        e.target.reset();

        activateTab('tab-pending');
    });

    // Delete Logic
    window.deleteReq = function(index) {
        if(confirm('هل أنت متأكد من حذف الطلب؟')) {
            requests.splice(index, 1);
            filterData();
        }
    };

    // Calculate Date Difference for the Modal
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const totalDaysInput = document.getElementById('totalDays');
    const daysCountInput = document.getElementById('daysCount');

    function calculateDiff() {
        const start = new Date(startDateInput.value);
        const end = new Date(endDateInput.value);

        if(start && end && !isNaN(start) && !isNaN(end)) {
            const timeDiff = end - start;
            if (timeDiff >= 0) {
                const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include starting day
                totalDaysInput.value = daysDiff + " أيام";
                daysCountInput.value = daysDiff;
            } else {
                totalDaysInput.value = "تاريخ غير صحيح";
                daysCountInput.value = "";
            }
        }
    }

    startDateInput.addEventListener('change', calculateDiff);
    endDateInput.addEventListener('change', calculateDiff);

    // File Name Update
    const fileInput = document.getElementById('fileUpload');
    const fileNameDisplay = document.getElementById('fileName');
    fileInput.addEventListener('change', function() {
        if(this.files && this.files.length > 0) {
            fileNameDisplay.textContent = this.files[0].name;
        } else {
            fileNameDisplay.textContent = "لم يتم اختيار أي ملف";
        }
    });
    // --- Notification System Logic ---
    const notifList = document.getElementById('notificationsList');
    const notifBadge = document.getElementById('notifCount');
    const emptyState = document.getElementById('emptyState');
    const markAllBtn = document.getElementById('markAll');

    function updateBadgeCount() {
        // Count only the immediate children that are notification items
        const count = notifList.querySelectorAll('.notif-item').length;
        
        notifBadge.textContent = count;
        
        if (count === 0) {
            notifBadge.style.display = 'none';
            emptyState.style.display = 'block';
            markAllBtn.style.display = 'none'; // Hide "Mark All" if empty
        } else {
            notifBadge.style.display = 'flex';
            emptyState.style.display = 'none';
            markAllBtn.style.display = 'block';
            
            // Add a little pop animation to badge
            notifBadge.classList.add('bump');
            setTimeout(() => notifBadge.classList.remove('bump'), 200);
        }
    }

    // Handle individual dismiss (Mark as read)
    notifList.addEventListener('click', function(e) {
        // Find the closest button if clicked on icon inside button
        const btn = e.target.closest('.mark-read-btn');
        
        if (btn) {
            const item = btn.closest('.notif-item');
            
            // Add fade out animation
            item.style.transition = 'all 0.3s ease';
            item.style.opacity = '0';
            item.style.transform = 'translateX(-20px)';
            
            setTimeout(() => {
                item.remove();
                updateBadgeCount();
            }, 300);
        }
    });

    // Handle Mark All
    markAllBtn.addEventListener('click', function() {
        const items = notifList.querySelectorAll('.notif-item');
        
        items.forEach((item, index) => {
            // Staggered animation
            setTimeout(() => {
                item.style.opacity = '0';
                item.style.transform = 'translateX(-20px)';
            }, index * 50);
        });

        setTimeout(() => {
            notifList.innerHTML = ''; // Clear all
            // We append the empty state back if it was cleared, or just toggle display
            // Since emptyState is a sibling in HTML, we just empty the list
            updateBadgeCount();
        }, items.length * 50 + 200);
    });

    // Initialize state on load
    updateBadgeCount();
    // Initial load
    filterData();
});