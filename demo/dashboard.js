let dashboardData = null;
let timelineChart = null;

const viewTitles = {
    overview: { title: 'Command Center', subtitle: 'Global Intent Index & Token Velocity' },
    users: { title: 'User Index', subtitle: 'Stochastic behavior tracking' },
    events: { title: 'Live Stream', subtitle: 'Real-time credit sizing actions' },
    tiers: { title: 'Tier Distribution', subtitle: 'Cohort intent analysis' },
    policy: { title: 'System Parameters', subtitle: 'Global variable constraints' },
};

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadData();

    // Refresh data periodically
    setInterval(loadData, 5000);
});

function initNavigation() {
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = link.getAttribute('data-view');
            switchView(viewId);
        });
    });
}

function switchView(viewId) {
    // Update Sidebar
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-view="${viewId}"]`).classList.add('active');

    // Update Title
    const metadata = viewTitles[viewId];
    if (metadata) {
        document.getElementById('page-title').textContent = metadata.title;
        document.getElementById('page-subtitle').textContent = metadata.subtitle;
    }

    // Update View Visibility
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');

    if (viewId === 'overview' && timelineChart) {
        timelineChart.update();
    }
}

async function loadData() {
    try {
        const response = await fetch('simulation_results.json');
        dashboardData = await response.json();
        updateUI();
    } catch (error) {
        console.error('Error loading simulation results:', error);
    }
}

function updateUI() {
    if (!dashboardData) return;

    updateHeader();
    renderKPIs();
    renderTimelineChart();
    renderUsersTable();
    renderEventsList();
    renderTierAnalysis();
}

function updateHeader() {
    document.getElementById('tick-count').textContent = `${dashboardData.summary.current_tick} ticks`;
    document.getElementById('user-count').textContent = `${dashboardData.summary.total_users} users`;
}

function renderKPIs() {
    const d = dashboardData;

    // Calculate aggregate intent score (weighted avg)
    const totalUsers = d.users.length;
    const avgIntent = d.users.reduce((acc, u) => acc + u.intent_score, 0) / totalUsers;

    const aggEl = document.getElementById('agg-intent-score');
    if (aggEl) {
        aggEl.textContent = avgIntent.toFixed(3);
    }

    // Animate flow stats
    animateNumber('kpi-credits-dispersed', d.summary.total_credits_dispersed, true);

    const remaining = d.pool ? d.pool.total_remaining : (1000000 - d.summary.total_credits_dispersed);
    animateNumber('pool-remaining', remaining, true);

    // Pool bar fill
    const fillPct = d.pool ? d.pool.utilization_pct : (d.summary.total_credits_dispersed / 1000000 * 100);
    document.getElementById('pool-bar-fill').style.width = `${fillPct}%`;
}

function animateNumber(id, endValue, isCompact = false) {
    const el = document.getElementById(id);
    if (!el) return;

    let displayVal = endValue;
    if (isCompact && endValue >= 1000) {
        displayVal = (endValue / 1000).toFixed(1) + 'K';
    }

    el.textContent = displayVal;
}

function renderTimelineChart() {
    const ctx = document.getElementById('timeline-chart');
    if (!ctx || timelineChart) return;

    const d = dashboardData.history;
    const labels = d.map(h => h.tick);

    timelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'High Intent',
                    data: d.map(h => h.tier_counts.high),
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Mid Intent',
                    data: d.map(h => h.tier_counts.mid),
                    borderColor: '#eab308',
                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Low Intent',
                    data: d.map(h => h.tier_counts.low),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' }
            },
            scales: {
                y: { beginAtZero: true },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderUsersTable() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    tbody.innerHTML = dashboardData.users.map(u => `
        <tr onclick="showUserModal('${u.id}')">
            <td>
                <div style="font-weight: 600;">${u.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-tertiary);">${u.persona.replace('_', ' ')}</div>
            </td>
            <td style="font-family: monospace;">${u.intent_score.toFixed(3)}</td>
            <td><span class="tier-tag tier-tag-${getTier(u.intent_score)}">${getTier(u.intent_score).toUpperCase()}</span></td>
            <td style="font-weight: 700;">${u.credit_balance}</td>
            <td>${u.total_credits_received}</td>
            <td>${u.total_sessions}</td>
            <td>
                <div style="width: 100px; height: 4px; background: #e2e8f0; border-radius: 2px;">
                    <div style="width: ${u.feature_depth * 100}%; height: 100%; background: var(--accent-primary); border-radius: 2px;"></div>
                </div>
            </td>
            <td style="color: var(--text-tertiary); font-size: 0.8rem;">${new Date(u.last_active).toLocaleTimeString()}</td>
        </tr>
    `).join('');
}

function getTier(score) {
    if (score <= 0.33) return 'low';
    if (score >= 0.67) return 'high';
    return 'mid';
}

function renderEventsList() {
    // Similar to users table but for events
}

function renderTierAnalysis() {
    // Populate the tier analysis grid
}

function showUserModal(userId) {
    // Logic to show user detail modal
    document.getElementById('user-modal').style.display = 'flex';
}

document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('user-modal').style.display = 'none';
});
