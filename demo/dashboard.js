let dashboardData = null;
let timelineChart   = null;
let todaySparkline  = null;
let currentFilter   = 'all';
let currentSort     = 'intent_score';
const prevValues = {};

const viewTitles = {
    overview: { title: 'Home',           subtitle: 'Global Intent Index & Credit Velocity' },
    users:    { title: 'User Index',     subtitle: 'Stochastic behavior tracking' },
    events:   { title: 'Live Feed',      subtitle: 'Credit sizing actions — audit trail' },
    tiers:    { title: 'Distribution',   subtitle: 'Cohort intent analysis' },
    policy:   { title: 'Parameters',     subtitle: 'Global variable constraints' },
};

/* ─── INIT ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initFilters();
    initPolicyButtons();
    initDragSections();
    initEditMode();
    initAddWidget();
    initSidebarResize();
    loadData();
    setInterval(loadData, 8000);
});

/* ─── NAV ────────────────────────────────────────────── */
function initNavigation() {
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            switchView(link.getAttribute('data-view'));
        });
    });
}

function switchView(viewId) {
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`[data-view="${viewId}"]`);
    if (activeLink) activeLink.classList.add('active');

    const meta = viewTitles[viewId];
    if (meta) {
        const titleEl    = document.getElementById('page-title');
        const subtitleEl = document.getElementById('page-subtitle');
        if (titleEl)    titleEl.textContent    = meta.title;
        if (subtitleEl) subtitleEl.textContent = meta.subtitle;
    }

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(`view-${viewId}`);
    if (view) view.classList.add('active');

    if (viewId === 'overview' && timelineChart) timelineChart.update();
}

/* ─── DATA ───────────────────────────────────────────── */
async function loadData() {
    try {
        const res = await fetch('simulation_results.json');
        dashboardData = await res.json();
        updateUI();
    } catch (err) {
        console.error('Failed to load simulation_results.json', err);
    }
}

function updateUI() {
    if (!dashboardData) return;
    updateHeader();
    renderKPIs();
    renderRevenue();
    renderTimelineChart();
    updateToday();
    renderUsersTable();
    renderEventsList();
    renderTierAnalysis();
    triggerEntrance();
}

/* ─── HEADER ─────────────────────────────────────────── */
function updateHeader() {
    const el = id => document.getElementById(id);
    if (el('tick-count')) el('tick-count').textContent = `${dashboardData.summary.current_tick} ticks`;
    if (el('user-count')) el('user-count').textContent = `${dashboardData.summary.total_users} users`;
}

/* ─── TODAY SECTION ──────────────────────────────────── */
function updateToday() {
    const d = dashboardData;
    if (!d) return;

    // Primary KPI: total credit activity as dollar value
    const totalActivity = d.summary.total_credits_dispersed * 0.005;
    countUpDollar('today-total', totalActivity);

    // Set current date
    const dateEl = document.getElementById('today-date');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    }

    // Draw sparkline from history
    renderTodaySparkline();
}

function renderTodaySparkline() {
    const canvas = document.getElementById('today-sparkline');
    if (!canvas || !dashboardData?.history?.length) return;

    if (todaySparkline) {
        todaySparkline.destroy();
        todaySparkline = null;
    }

    const hist = dashboardData.history;
    const ctx  = canvas.getContext('2d');
    const blue = '#0279FD';

    todaySparkline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hist.map(h => h.tick),
            datasets: [{
                data:        hist.map(h => h.credits_dispersed),
                borderColor: blue,
                borderWidth: 1.5,
                fill:        false,
                tension:     0.45,
                pointRadius: 0,
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            animation:           { duration: 800 },
            plugins: {
                legend:  { display: false },
                tooltip: { enabled: false },
            },
            scales: {
                x: { display: false },
                y: { display: false },
            },
        }
    });
}

/* ─── KPIs ───────────────────────────────────────────── */
function renderKPIs() {
    const d = dashboardData;
    const totalUsers = d.users.length;
    const avgIntent  = d.users.reduce((a, u) => a + u.intent_score, 0) / totalUsers;

    countUpFloat('agg-intent-score', avgIntent, 900, 3);
    countUp('kpi-credits-dispersed', d.summary.total_credits_dispersed, 900);

    const remaining = d.pool ? d.pool.total_remaining : (1000000 - d.summary.total_credits_dispersed);
    countUp('pool-remaining', remaining, 900);

    const fillPct = d.pool
        ? d.pool.utilization_pct
        : (d.summary.total_credits_dispersed / 1000000 * 100);

    // Delay pool bar so it animates after count-up
    setTimeout(() => {
        const bar = document.getElementById('pool-bar-fill');
        if (bar) bar.style.width = `${fillPct}%`;
    }, 200);
}

/* ─── COUNT-UP ANIMATIONS ────────────────────────────── */
function countUp(elId, end, duration = 800) {
    const el = document.getElementById(elId);
    if (!el) return;
    const startVal = prevValues[elId] ?? null;
    if (startVal !== null && startVal === end) return; // unchanged — leave it
    prevValues[elId] = end;
    const from = startVal ?? 0;
    const startTime = performance.now();

    function frame(now) {
        const p     = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(from + (end - from) * eased).toLocaleString();
        if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

function countUpFloat(elId, end, duration = 800, decimals = 3) {
    const el = document.getElementById(elId);
    if (!el) return;
    const startVal = prevValues[elId] ?? null;
    if (startVal !== null && Math.abs(startVal - end) < Math.pow(10, -decimals) / 2) return;
    prevValues[elId] = end;
    const from = startVal ?? 0;
    const startTime = performance.now();

    function frame(now) {
        const p     = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (from + (end - from) * eased).toFixed(decimals);
        if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

/* ─── ENTRANCE ANIMATION ─────────────────────────────── */
let entranceDone = false;
function triggerEntrance() {
    if (entranceDone) return;
    entranceDone = true;

    const targets = [
        document.querySelector('.header'),
        ...document.querySelectorAll('.dash-section'),
    ];

    targets.forEach((el, i) => {
        if (!el) return;
        el.classList.add('animate-in', `d${Math.min(i + 1, 6)}`);
    });
}

/* ─── CHART ──────────────────────────────────────────── */
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

function makeGradient(ctx, height, hex) {
    const { r, g, b } = hexToRgb(hex);
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0,   `rgba(${r},${g},${b},0.10)`);
    grad.addColorStop(0.6, `rgba(${r},${g},${b},0.03)`);
    grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);
    return grad;
}

function customTooltip(context) {
    const tip = document.getElementById('chart-tooltip');
    if (!tip) return;

    if (context.tooltip.opacity === 0) {
        tip.classList.remove('visible');
        return;
    }

    const pts = context.tooltip.dataPoints || [];
    if (!pts.length) return;

    const tick  = pts[0].label;
    const rows  = pts.map(dp => `
        <div class="tooltip-row">
            <span class="tooltip-label">
                <span style="width:6px;height:6px;border-radius:50%;background:${dp.dataset.borderColor};display:inline-block;flex-shrink:0;"></span>
                ${dp.dataset.label}
            </span>
            <span class="tooltip-val">${Number(dp.raw).toLocaleString()}</span>
        </div>
    `).join('');

    tip.innerHTML = `<div class="tooltip-tick">Tick ${tick}</div>${rows}`;

    const { offsetLeft: x0, offsetTop: y0 } = context.chart.canvas;
    const { caretX, caretY } = context.tooltip;

    // Keep tooltip inside chart bounds
    const tipW = 160;
    let left = x0 + caretX + 14;
    if (left + tipW > window.innerWidth - 20) left = x0 + caretX - tipW - 14;

    tip.style.left = `${left}px`;
    tip.style.top  = `${y0 + caretY - 28}px`;
    tip.classList.add('visible');
}

function renderTimelineChart() {
    const canvas = document.getElementById('timeline-chart');
    if (!canvas || timelineChart) return;

    const hist = dashboardData.history || [];
    if (!hist.length) return;
    const ctx    = canvas.getContext('2d');
    const height = canvas.offsetHeight || 260;
    const labels = hist.map(h => h.tick);

    const blue = '#0279FD';

    const datasets = [
        {
            label:                     'Credit Velocity',
            data:                      hist.map(h => h.credits_dispersed),
            borderColor:               blue,
            backgroundColor:           makeGradient(ctx, height, blue),
            fill:                      true,
            tension:                   0.45,
            pointRadius:               0,
            pointHoverRadius:          4,
            pointHoverBackgroundColor: blue,
            pointHoverBorderColor:     '#fff',
            pointHoverBorderWidth:     2,
            borderWidth:               1.5,
        },
    ];

    const crosshairPlugin = {
        id: 'crosshair',
        afterDraw(chart) {
            const { ctx, chartArea, tooltip } = chart;
            if (!tooltip || tooltip.opacity === 0) return;
            const x = tooltip.caretX;
            ctx.save();
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = 'rgba(10, 22, 40, 0.14)';
            ctx.lineWidth   = 1;
            ctx.beginPath();
            ctx.moveTo(x, chartArea.top);
            ctx.lineTo(x, chartArea.bottom);
            ctx.stroke();
            ctx.restore();
        },
    };

    timelineChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        plugins: [crosshairPlugin],
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            animation: {
                duration: 1400,
                easing:   'easeInOutQuart',
            },
            interaction: {
                mode:      'index',
                intersect: false,
            },
            plugins: {
                legend:  { display: false },
                tooltip: { enabled: false, external: customTooltip },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    border:      { display: false },
                    grid: {
                        color:     'rgba(10, 22, 40, 0.045)',
                        lineWidth: 1,
                    },
                    ticks: {
                        color:         'rgba(10, 22, 40, 0.28)',
                        font:          { size: 10, family: "'SF Mono', ui-monospace, monospace" },
                        maxTicksLimit: 5,
                        padding:       10,
                        callback: v => v.toLocaleString(),
                    },
                },
                x: {
                    border: { display: false },
                    grid:   { display: false },
                    ticks: {
                        color:         'rgba(10, 22, 40, 0.28)',
                        font:          { size: 10, family: "'SF Mono', ui-monospace, monospace" },
                        maxTicksLimit: 10,
                        padding:       8,
                        maxRotation:   0,
                    },
                },
            },
        },
    });
}

/* ─── USERS TABLE ────────────────────────────────────── */
function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            renderUsersTable();
        });
    });

    document.getElementById('sort-select')?.addEventListener('change', e => {
        currentSort = e.target.value;
        renderUsersTable();
    });
}

function getTier(score) {
    if (score >= 0.67) return 'high';
    if (score >= 0.34) return 'mid';
    return 'low';
}

function renderUsersTable() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody || !dashboardData) return;

    let users = [...dashboardData.users];

    if (currentFilter !== 'all') {
        users = users.filter(u => getTier(u.intent_score) === currentFilter);
    }

    users.sort((a, b) => (b[currentSort] ?? 0) - (a[currentSort] ?? 0));

    tbody.innerHTML = users.map(u => {
        const tier  = getTier(u.intent_score);
        const depth = ((u.feature_depth ?? 0) * 100).toFixed(0);
        const time  = new Date(u.last_active).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
        <tr onclick="showUserModal('${u.id}')">
            <td>
                <div style="font-weight:500;font-size:13px;">${u.name}</div>
                <div style="font-size:10px;color:rgba(10,22,40,0.32);text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">${(u.persona ?? '').replace(/_/g, ' ')}</div>
            </td>
            <td><span style="font-family:'SF Mono',ui-monospace,monospace;font-size:12px;">${u.intent_score.toFixed(3)}</span></td>
            <td><span class="tier-tag tier-tag-${tier}">${tier.toUpperCase()}</span></td>
            <td><span style="font-family:'SF Mono',ui-monospace,monospace;font-weight:600;">${u.credit_balance.toLocaleString()}</span></td>
            <td><span style="font-family:'SF Mono',ui-monospace,monospace;">${(u.total_credits_received ?? 0).toLocaleString()}</span></td>
            <td>${u.total_sessions}</td>
            <td><div class="depth-bar"><div class="depth-bar-fill" style="width:${depth}%"></div></div></td>
            <td style="font-family:'SF Mono',ui-monospace,monospace;font-size:10px;color:rgba(10,22,40,0.32);">${time}</td>
        </tr>`;
    }).join('');
}

/* ─── EVENTS LIST ────────────────────────────────────── */
const ACTION_LABELS = {
    progressive_topup: 'Progressive top-up issued',
    usage_bonus:       'Usage bonus triggered',
    low_drip:          'Low-intent drip credit',
    initial_grant:     'Initial credit grant',
    credit_topup:      'Credit top-up issued',
};

function renderEventsList() {
    const list = document.getElementById('events-list');
    if (!list || !dashboardData?.events?.length) {
        if (list) list.innerHTML = `<div style="padding:40px;text-align:center;font-size:12px;color:rgba(10,22,40,0.3);">No events recorded.</div>`;
        return;
    }

    const events = dashboardData.events.slice(0, 80);
    list.innerHTML = events.map(e => {
        const time   = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const action = ACTION_LABELS[e.action] ?? (e.action ?? '').replace(/_/g, ' ');
        const amount = e.amount ? `+${e.amount}` : '';

        return `
        <div class="event-item">
            <span class="event-time">${time}</span>
            <span class="event-user">${e.user_name ?? e.user_id ?? '—'}</span>
            <span class="event-action">${action}</span>
            <span class="event-amount">${amount}</span>
        </div>`;
    }).join('');
}

/* ─── TIER ANALYSIS ──────────────────────────────────── */
function renderTierAnalysis() {
    const grid = document.getElementById('tier-analysis-grid');
    if (!grid || !dashboardData) return;

    const users = dashboardData.users;
    const total = users.length;

    const groups = {
        high: users.filter(u => getTier(u.intent_score) === 'high'),
        mid:  users.filter(u => getTier(u.intent_score) === 'mid'),
        low:  users.filter(u => getTier(u.intent_score) === 'low'),
    };

    const config = [
        { key: 'high', label: 'High Intent', color: '#10b981' },
        { key: 'mid',  label: 'Mid Intent',  color: '#f59e0b' },
        { key: 'low',  label: 'Low Intent',  color: '#ef4444' },
    ];

    grid.innerHTML = config.map(t => {
        const g          = groups[t.key];
        const count      = g.length;
        const pct        = total ? ((count / total) * 100).toFixed(1) : '0.0';
        const avgIntent  = count ? (g.reduce((a, u) => a + u.intent_score, 0) / count).toFixed(3) : '0.000';
        const avgBalance = count ? Math.round(g.reduce((a, u) => a + u.credit_balance, 0) / count) : 0;
        const avgRcvd    = count ? Math.round(g.reduce((a, u) => a + (u.total_credits_received ?? 0), 0) / count) : 0;

        return `
        <div class="tier-analysis-card">
            <div class="tier-analysis-title">
                <span style="width:6px;height:6px;border-radius:50%;background:${t.color};display:inline-block;flex-shrink:0;"></span>
                ${t.label}
            </div>
            <div class="tier-analysis-num" style="color:${t.color};">${count.toLocaleString()}</div>
            <div class="tier-analysis-sub">${pct}% of all users</div>
            <div class="tier-bar" style="margin-bottom:20px;">
                <div class="tier-bar-fill" style="width:${pct}%;background:${t.color};"></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:0;">
                <div class="tier-stat-row">
                    <span class="tier-stat-label">Avg Intent Score</span>
                    <span class="tier-stat-val">${avgIntent}</span>
                </div>
                <div class="tier-stat-row">
                    <span class="tier-stat-label">Avg Credit Balance</span>
                    <span class="tier-stat-val">${avgBalance.toLocaleString()}</span>
                </div>
                <div class="tier-stat-row">
                    <span class="tier-stat-label">Avg Credits Received</span>
                    <span class="tier-stat-val">${avgRcvd.toLocaleString()}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

/* ─── USER MODAL ─────────────────────────────────────── */
function showUserModal(userId) {
    const overlay = document.getElementById('user-modal');
    if (!overlay || !dashboardData) return;

    const u = dashboardData.users.find(x => x.id === userId);
    if (!u) return;

    const tier = getTier(u.intent_score);
    const tierColors = { high: '#10b981', mid: '#f59e0b', low: '#ef4444' };

    document.getElementById('modal-header').innerHTML = `
        <h2>${u.name}</h2>
        <p style="display:flex;align-items:center;gap:8px;">
            <span style="text-transform:uppercase;letter-spacing:0.05em;">${(u.persona ?? '').replace(/_/g, ' ')}</span>
            <span style="color:rgba(10,22,40,0.2);">·</span>
            <span class="tier-tag tier-tag-${tier}">${tier.toUpperCase()}</span>
        </p>
    `;

    document.getElementById('modal-body').innerHTML = `
        <div class="modal-stat-grid">
            <div class="modal-stat">
                <div class="modal-stat-label">Intent Score</div>
                <div class="modal-stat-val" style="color:${tierColors[tier]};">${u.intent_score.toFixed(3)}</div>
            </div>
            <div class="modal-stat">
                <div class="modal-stat-label">Credit Balance</div>
                <div class="modal-stat-val">${u.credit_balance.toLocaleString()}</div>
            </div>
            <div class="modal-stat">
                <div class="modal-stat-label">Total Received</div>
                <div class="modal-stat-val">${(u.total_credits_received ?? 0).toLocaleString()}</div>
            </div>
            <div class="modal-stat">
                <div class="modal-stat-label">Sessions</div>
                <div class="modal-stat-val">${u.total_sessions}</div>
            </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
            <div class="tier-stat-row">
                <span class="tier-stat-label">Feature Depth</span>
                <span class="tier-stat-val">${((u.feature_depth ?? 0) * 100).toFixed(1)}%</span>
            </div>
            <div class="tier-stat-row">
                <span class="tier-stat-label">API Usage Volume</span>
                <span class="tier-stat-val">${(u.api_usage_vol ?? 0).toLocaleString()}</span>
            </div>
            <div class="tier-stat-row">
                <span class="tier-stat-label">Last Active</span>
                <span class="tier-stat-val">${new Date(u.last_active).toLocaleString()}</span>
            </div>
        </div>
    `;

    overlay.style.display = 'flex';
}

document.getElementById('modal-close')?.addEventListener('click', () => {
    document.getElementById('user-modal').style.display = 'none';
});

document.getElementById('user-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});

/* ─── DRAG SECTIONS ──────────────────────────────────── */
function initDragSections() {
    const container = document.getElementById('sections-container');
    if (!container) return;

    loadSectionOrder();

    let dragEl      = null;
    let placeholder = null;
    let rafPending  = false;

    // Placeholder mirrors the dragged card's grid slot
    function makePlaceholder(fromEl) {
        const ph = document.createElement('div');
        ph.className = 'drag-placeholder';
        if (fromEl.classList.contains('dash-section--full')) {
            ph.style.gridColumn = '1 / -1';
        }
        return ph;
    }

    // Given a cursor position, find the nearest section and whether to insert before/after it.
    // Works from anywhere on the page — gaps, empty space, corners, all of it.
    function getNearestDropTarget(cursorX, cursorY) {
        const sections = [...container.querySelectorAll('.dash-section')]
            .filter(s => s !== dragEl && !s.classList.contains('drag-placeholder'));

        if (!sections.length) return null;

        let best     = null;
        let bestDist = Infinity;

        for (const s of sections) {
            const r = s.getBoundingClientRect();

            // Clamp cursor to the section's bounding rect, then measure distance.
            // Distance is 0 when cursor is inside the rect, positive when outside.
            const clampedX = Math.max(r.left, Math.min(r.right,  cursorX));
            const clampedY = Math.max(r.top,  Math.min(r.bottom, cursorY));
            const dist     = Math.hypot(cursorX - clampedX, cursorY - clampedY);

            if (dist < bestDist) {
                bestDist = dist;
                best     = s;
            }
        }

        if (!best) return null;

        const r      = best.getBoundingClientRect();
        const midY   = r.top + r.height / 2;
        const before = cursorY < midY;

        return { section: best, before };
    }

    container.addEventListener('dragstart', e => {
        dragEl = e.target.closest('.dash-section');
        if (!dragEl) return;

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragEl.dataset.section);

        placeholder = makePlaceholder(dragEl);

        // Wait one frame so the browser captures the native drag ghost
        // before we apply opacity changes or insert the placeholder
        requestAnimationFrame(() => {
            if (!dragEl) return;
            dragEl.classList.add('dragging');
            dragEl.after(placeholder);
        });
    });

    container.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!dragEl || !placeholder) return;

        // Throttle DOM writes to one per animation frame
        if (rafPending) return;
        rafPending = true;

        const cursorX = e.clientX;
        const cursorY = e.clientY;

        requestAnimationFrame(() => {
            rafPending = false;
            if (!dragEl || !placeholder) return;

            const drop = getNearestDropTarget(cursorX, cursorY);
            if (!drop) return;

            const { section, before } = drop;

            // Only mutate DOM if the placeholder would actually move
            const nextSibling = before ? section : section.nextSibling;
            if (placeholder.nextSibling !== nextSibling) {
                if (before) {
                    container.insertBefore(placeholder, section);
                } else {
                    section.after(placeholder);
                }
            }
        });
    });

    // On dragend: slot the real element where the placeholder landed
    container.addEventListener('dragend', () => {
        if (!dragEl) return;
        dragEl.classList.remove('dragging');

        if (placeholder && placeholder.parentNode) {
            placeholder.replaceWith(dragEl);
        }

        dragEl      = null;
        placeholder = null;
        rafPending  = false;
        saveSectionOrder();
    });

    container.addEventListener('drop', e => e.preventDefault());
}

function saveSectionOrder() {
    try {
        const order = [...document.querySelectorAll('.dash-section')].map(s => s.dataset.section);
        localStorage.setItem('ignitris_section_order', JSON.stringify(order));
    } catch(e) {}
}

function loadSectionOrder() {
    try {
        const saved = localStorage.getItem('ignitris_section_order');
        if (!saved) return;
        const order = JSON.parse(saved);
        if (!Array.isArray(order)) return;
        const container = document.getElementById('sections-container');
        if (!container) return;

        // Validate: all saved IDs must exist in the current DOM.
        // If any are missing (layout changed), discard the saved order entirely.
        const allPresent = order.every(id => container.querySelector(`[data-section="${id}"]`));
        if (!allPresent) {
            localStorage.removeItem('ignitris_section_order');
            return;
        }

        order.forEach(sectionId => {
            const el = container.querySelector(`[data-section="${sectionId}"]`);
            if (el) container.appendChild(el);
        });
    } catch(e) {}
}

/* ─── REVENUE ────────────────────────────────────────── */
function renderRevenue() {
    const d = dashboardData;
    if (!d) return;

    // $0.005 per credit — treat simulation period as one month of activity
    const CREDIT_PRICE = 0.005;
    const totalCredits = d.summary.total_credits_dispersed;
    const totalUsers   = d.users.length;

    const grossVolume = totalCredits * CREDIT_PRICE;
    const mrr         = grossVolume;
    const arr         = mrr * 12;
    const arpu        = totalUsers > 0 ? grossVolume / totalUsers : 0;

    countUpDollar('rev-gross', grossVolume);
    countUpDollar('rev-mrr',   mrr);
    countUpDollar('rev-arr',   arr);
    countUpDollarFloat('rev-arpu', arpu);
}

function countUpDollar(elId, end, duration = 900) {
    const el = document.getElementById(elId);
    if (!el) return;
    const startVal = prevValues[elId] ?? null;
    if (startVal !== null && startVal === end) return;
    prevValues[elId] = end;
    const from = startVal ?? 0;
    const startTime = performance.now();
    function frame(now) {
        const p     = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = '$' + Math.round(from + (end - from) * eased).toLocaleString();
        if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

function countUpDollarFloat(elId, end, duration = 900) {
    const el = document.getElementById(elId);
    if (!el) return;
    const startVal = prevValues[elId] ?? null;
    if (startVal !== null && Math.abs(startVal - end) < 0.005) return;
    prevValues[elId] = end;
    const from = startVal ?? 0;
    const startTime = performance.now();
    function frame(now) {
        const p     = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = '$' + (from + (end - from) * eased).toFixed(2);
        if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

/* ─── EDIT MODE ──────────────────────────────────────── */
let editMode = false;

function initEditMode() {
    const btn       = document.getElementById('btn-edit-sections');
    const container = document.getElementById('sections-container');
    if (!btn || !container) return;

    btn.addEventListener('click', () => {
        editMode = !editMode;
        container.classList.toggle('editing', editMode);

        // Toggle draggable on all sections
        container.querySelectorAll('.dash-section').forEach(s => {
            s.draggable = editMode;
        });

        // Update button label + active styling
        btn.innerHTML = editMode ? '&#10003; Done' : '&#9881; Edit';
        btn.classList.toggle('ctrl-btn--active', editMode);
    });
}

/* ─── ADD WIDGET PANEL ───────────────────────────────── */
function initAddWidget() {
    const overlay = document.getElementById('add-widget-overlay');
    if (!overlay) return;

    document.getElementById('btn-add-section')?.addEventListener('click', () => {
        overlay.style.display = 'flex';
    });

    document.getElementById('add-widget-close')?.addEventListener('click', () => {
        overlay.style.display = 'none';
    });

    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.style.display = 'none';
    });
}

/* ─── SIDEBAR RESIZE ─────────────────────────────────── */
function initSidebarResize() {
    const resizer = document.getElementById('sidebar-resizer');
    const sidebar = document.getElementById('sidebar');
    if (!resizer || !sidebar) return;

    let isResizing = false;
    let startX     = 0;
    let startWidth = 232;

    resizer.addEventListener('mousedown', e => {
        isResizing = true;
        startX     = e.clientX;
        startWidth = sidebar.offsetWidth;
        resizer.classList.add('dragging');
        document.body.style.cursor     = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
        if (!isResizing) return;
        const delta    = e.clientX - startX;
        const newWidth = Math.max(180, Math.min(340, startWidth + delta));
        document.documentElement.style.setProperty('--sidebar-w', `${newWidth}px`);
    });

    document.addEventListener('mouseup', () => {
        if (!isResizing) return;
        isResizing = false;
        resizer.classList.remove('dragging');
        document.body.style.cursor     = '';
        document.body.style.userSelect = '';
    });
}

/* ─── POLICY BUTTONS ─────────────────────────────────── */
function initPolicyButtons() {
    document.getElementById('btn-save-policy')?.addEventListener('click', () => {
        const btn = document.getElementById('btn-save-policy');
        btn.textContent = 'Applied';
        setTimeout(() => { btn.textContent = 'Apply Policy Changes'; }, 1800);
    });

    document.getElementById('btn-reset-policy')?.addEventListener('click', () => {
        document.getElementById('policy-low-max').value  = '0.33';
        document.getElementById('policy-mid-min').value  = '0.34';
        document.getElementById('policy-high-min').value = '0.67';
        document.getElementById('policy-low-credit').value  = '10';
        document.getElementById('policy-mid-credit').value  = '25';
        document.getElementById('policy-high-credit').value = '40';
        document.getElementById('policy-multiplier').value  = '1.2';
        document.getElementById('policy-max-topup').value   = '100';
        document.getElementById('policy-max-daily').value   = '200';
    });
}
