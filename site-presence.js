// =========================================================================
// SITE-WIDE PRESENCE & REAL-TIME PEER BUDDY NOTIFICATIONS
// =========================================================================
(function () {
    const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '80' && window.location.port !== ''
        ? 'http://localhost:5000/api'
        : '/api';

    let notifItems = [];
    let notifDropdownOpen = false;

    // Inject shared notification bell CSS if not already present
    function injectNotifStyles() {
        if (document.getElementById('sitePresenceNotifStyles')) return;
        const style = document.createElement('style');
        style.id = 'sitePresenceNotifStyles';
        style.textContent = `
            .nav-notif-wrap {
                position: relative;
                display: inline-flex;
                align-items: center;
            }
            .nav-bell-btn {
                position: relative;
                width: 38px;
                height: 38px;
                border-radius: 50%;
                background: #f4f1ff;
                border: 1.5px solid #dcd5ff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                transition: all 0.2s ease;
                cursor: pointer;
                color: #241c63;
                padding: 0;
            }
            .nav-bell-btn:hover {
                background: #ede8ff;
                border-color: #6d4dff;
                transform: scale(1.05);
            }
            .nav-bell-badge {
                position: absolute;
                top: -4px;
                right: -4px;
                background: #e53e3e;
                color: #fff;
                font-size: 10px;
                font-weight: 800;
                min-width: 17px;
                height: 17px;
                border-radius: 999px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 3px;
                border: 2px solid #fff;
                animation: siteBellPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                box-shadow: 0 2px 6px rgba(229, 62, 62, 0.4);
            }
            @keyframes siteBellPop {
                0% { transform: scale(0.4); }
                70% { transform: scale(1.2); }
                100% { transform: scale(1); }
            }
            .notif-dropdown {
                position: absolute;
                top: calc(100% + 10px);
                right: 0;
                width: 320px;
                background: #ffffff;
                border: 1.5px solid #e2ddfe;
                border-radius: 14px;
                box-shadow: 0 14px 45px rgba(31, 27, 77, 0.16);
                z-index: 99999;
                overflow: hidden;
                animation: siteDropIn 0.2s ease;
                text-align: left;
            }
            @keyframes siteDropIn {
                from { opacity: 0; transform: translateY(-8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .notif-dropdown-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                background: #f8f6ff;
                border-bottom: 1px solid #ede8ff;
            }
            .notif-dropdown-title {
                font-size: 13.5px;
                font-weight: 700;
                color: #1f1b4d;
            }
            .notif-mark-read-btn {
                font-size: 11px;
                font-weight: 600;
                color: #6d4dff;
                background: none;
                border: none;
                cursor: pointer;
                padding: 2px 6px;
                border-radius: 4px;
            }
            .notif-mark-read-btn:hover {
                text-decoration: underline;
            }
            .notif-list {
                max-height: 360px;
                overflow-y: auto;
            }
            .notif-item {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 12px 16px;
                border-bottom: 1px solid #f0ecff;
                cursor: pointer;
                transition: background 0.15s ease;
                text-decoration: none;
                color: inherit;
            }
            .notif-item:hover {
                background: #f8f6ff;
            }
            .notif-item.unread {
                background: #f3efff;
            }
            .notif-icon {
                font-size: 20px;
                flex-shrink: 0;
                margin-top: 1px;
            }
            .notif-body {
                flex: 1;
                min-width: 0;
            }
            .notif-text {
                font-size: 12.5px;
                font-weight: 600;
                color: #1f1b4d;
                line-height: 1.35;
                margin-bottom: 3px;
                word-break: break-word;
            }
            .notif-sub {
                font-size: 11px;
                color: #7b7899;
            }
            .notif-empty {
                padding: 28px 16px;
                text-align: center;
                color: #7b7899;
                font-size: 12.5px;
            }
        `;
        document.head.appendChild(style);
    }

    // Helper: Escape HTML
    function esc(s) {
        if (!s) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Ensure Notification Bell exists in nav
    function ensureNavBell() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) return null;

        let wrap = document.getElementById('navNotifWrap');
        if (!wrap) {
            const navActions = document.querySelector('.nav-actions');
            if (!navActions) return null;

            wrap = document.createElement('div');
            wrap.className = 'nav-notif-wrap';
            wrap.id = 'navNotifWrap';
            wrap.innerHTML = `
                <button class="nav-bell-btn" id="navBellBtn" type="button" title="Notifications" aria-label="Notifications">
                    🔔
                    <span class="nav-bell-badge" id="navBellBadge" style="display: none;">0</span>
                </button>
                <div class="notif-dropdown" id="notifDropdown" style="display: none;">
                    <div class="notif-dropdown-header">
                        <span class="notif-dropdown-title">🔔 Notifications</span>
                        <button class="notif-mark-read-btn" id="btnMarkAllRead" type="button">Mark all read</button>
                    </div>
                    <div class="notif-list" id="notifList">
                        <div class="notif-empty" id="notifEmpty">No new notifications</div>
                    </div>
                </div>
            `;

            // Insert before userBadge or at start of navActions
            const userBadge = document.getElementById('userBadge');
            if (userBadge && userBadge.nextSibling) {
                navActions.insertBefore(wrap, userBadge.nextSibling);
            } else {
                navActions.insertBefore(wrap, navActions.firstChild);
            }
        }

        wrap.style.display = 'inline-flex';
        bindBellEvents();
        return wrap;
    }

    function renderBellDropdown() {
        const notifList = document.getElementById('notifList');
        const badge = document.getElementById('navBellBadge');

        const unreadCount = notifItems.filter(n => !n.isRead).length;

        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        if (!notifList) return;

        if (notifItems.length === 0) {
            notifList.innerHTML = '<div class="notif-empty">No new notifications</div>';
            return;
        }

        notifList.innerHTML = notifItems.map(n => `
            <div class="notif-item ${n.isRead ? '' : 'unread'}" data-id="${n.id}" data-match="${n.matchId || ''}">
                <div class="notif-icon">${n.icon || '💬'}</div>
                <div class="notif-body">
                    <div class="notif-text">${esc(n.text)}</div>
                    <div class="notif-sub">${esc(n.sub || '')}</div>
                </div>
            </div>
        `).join('');

        // Wire item clicks
        notifList.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                const matchId = item.getAttribute('data-match');
                handleItemClick(id, matchId);
            });
        });
    }

    async function handleItemClick(notifId, matchId) {
        const authToken = localStorage.getItem('authToken');
        const notif = notifItems.find(n => n.id === notifId);
        if (notif) notif.isRead = true;
        renderBellDropdown();

        if (matchId && authToken) {
            try {
                await fetch(`${API_BASE}/peer/buddy/mark-read`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ matchId })
                });
            } catch (e) {}
        }

        const dropdown = document.getElementById('notifDropdown');
        if (dropdown) dropdown.style.display = 'none';
        notifDropdownOpen = false;

        // If on peer-support.html, switch to buddy tab smoothly
        if (window.location.pathname.endsWith('peer-support.html') || window.location.pathname.endsWith('peer-support')) {
            const buddyTabBtn = document.querySelector('.support-card-btn[data-tab="tab-buddy"]');
            if (buddyTabBtn) {
                buddyTabBtn.click();
                setTimeout(() => {
                    const buddySection = document.getElementById('tab-buddy');
                    if (buddySection) buddySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    const input = document.getElementById('buddyMsgInput');
                    if (input) input.focus();
                }, 200);
            }
        } else {
            // Navigate to peer-support.html with tab=buddy query
            window.location.href = 'peer-support.html?tab=buddy';
        }
    }

    function bindBellEvents() {
        const btn = document.getElementById('navBellBtn');
        const dropdown = document.getElementById('notifDropdown');
        const markAllBtn = document.getElementById('btnMarkAllRead');

        if (btn && !btn._hasClick) {
            btn._hasClick = true;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!dropdown) return;
                notifDropdownOpen = !notifDropdownOpen;
                dropdown.style.display = notifDropdownOpen ? 'block' : 'none';
                if (notifDropdownOpen) {
                    fetchNotifications();
                    renderBellDropdown();
                }
            });
        }

        if (markAllBtn && !markAllBtn._hasClick) {
            markAllBtn._hasClick = true;
            markAllBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                notifItems.forEach(n => n.isRead = true);
                renderBellDropdown();
                const authToken = localStorage.getItem('authToken');
                if (authToken) {
                    try {
                        await fetch(`${API_BASE}/peer/buddy/mark-read`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${authToken}`
                            },
                            body: JSON.stringify({})
                        });
                    } catch (err) {}
                }
            });
        }

        // Close when clicking outside
        if (!document._siteNotifCloseBound) {
            document._siteNotifCloseBound = true;
            document.addEventListener('click', () => {
                const dd = document.getElementById('notifDropdown');
                if (dd && notifDropdownOpen) {
                    dd.style.display = 'none';
                    notifDropdownOpen = false;
                }
            });
        }
    }

    function applyNotifications(serverNotifs, unreadCount) {
        if (Array.isArray(serverNotifs) && serverNotifs.length > 0) {
            notifItems = serverNotifs.map(n => ({
                id: n.id || `notif_${n.matchId}`,
                type: n.type || 'buddy_msg',
                icon: '💬',
                text: n.text,
                sub: n.sub || 'Tap to open chat',
                isRead: false,
                matchId: n.matchId,
                unreadCount: n.unreadCount || 1
            }));
        } else if (unreadCount === 0) {
            notifItems.forEach(n => { if (n.type === 'buddy_msg') n.isRead = true; });
        }
        renderBellDropdown();
    }

    async function fetchNotifications() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) return;
        try {
            const res = await fetch(`${API_BASE}/peer/buddy/notifications`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.notifications)) {
                applyNotifications(data.notifications, data.unreadCount || 0);
            }
        } catch (e) {}
    }

    // Heartbeat: marks student online on ANY page of the site and pulls live unread buddy alerts
    async function pingPresence() {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) return;
        try {
            const res = await fetch(`${API_BASE}/peer/buddy/heartbeat`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const data = await res.json();
            if (data.success) {
                ensureNavBell();
                if (Array.isArray(data.notifications)) {
                    applyNotifications(data.notifications, data.unreadCount || 0);
                }
            }
        } catch (e) {}
    }

    // Initialize on DOM ready
    function init() {
        injectNotifStyles();
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
            ensureNavBell();
            fetchNotifications();
            pingPresence();
            setInterval(pingPresence, 15000); // Heartbeat every 15s across the entire site
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export to window for access by peer-support.html
    window.SitePresence = {
        fetchNotifications,
        applyNotifications,
        pingPresence
    };
})();
