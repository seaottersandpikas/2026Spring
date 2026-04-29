// ── 전역 상태 ──────────────────────────────────────────
var AppState = {
    currentUser: null,
    currentProfile: null,
    bizCurrentStep: 1,
    pendingMatch: {},
    priceHints: {
        '아크릴굿즈':'1,800~3,500원', '의류/패브릭':'7,000~25,000원',
        '문구/스티커':'300~1,500원', '패키징':'800~3,000원',
        '봉제인형':'10,000~30,000원', '금속/뱃지':'2,000~5,000원',
        '생활용품':'3,000~15,000원'
    }
};

// ── 앱 초기화 ──────────────────────────────────────────
async function initApp() {
    // supabaseClient 준비 대기 (최대 2초)
    for (var i = 0; i < 20; i++) {
        if (window.supabaseClient) break;
        await new Promise(function(r){ setTimeout(r, 100); });
    }
    if (!window.supabaseClient) {
        showToast('연결 오류. 새로고침해주세요.', 'error');
        return;
    }
    console.log('✅ App 초기화 시작');

    // 인증 상태 감지
    Auth.onAuthStateChange(async function(event, session) {
        if (event === 'SIGNED_IN' && session) {
            AppState.currentUser = session.user;
            AppState.currentProfile = await Auth.getProfile();
            updateUILoggedIn();
        } else if (event === 'SIGNED_OUT') {
            AppState.currentUser = null;
            AppState.currentProfile = null;
            updateUILoggedOut();
        }
    });

    // 현재 로그인 상태 확인
    try {
        var user = await Auth.getUser();
        if (user) {
            AppState.currentUser = user;
            AppState.currentProfile = await Auth.getProfile();
            updateUILoggedIn();
        }
    } catch(e) { /* 비로그인 상태 */ }

    // 매칭 이력 로드
    loadMatchHistoryBiz();
    loadMatchHistoryPersonal();

    // 카테고리 변경 시 가격 힌트
    var bizCat = document.getElementById('biz-category');
    if (bizCat) {
        bizCat.addEventListener('change', function() {
            var hint = AppState.priceHints[this.value];
            var el = document.getElementById('biz-price-hint');
            if (el) el.textContent = hint ? '시장 평균 참고가: ' + hint : '카테고리를 선택하면 표시됩니다';
        });
    }

    // 모달 오버레이 클릭 시 닫기
    document.querySelectorAll('.modal-overlay').forEach(function(o) {
        o.addEventListener('click', function(e) {
            if (e.target === this) this.classList.remove('show');
        });
    });
}

// ── UI 상태 업데이트 ───────────────────────────────────
function updateUILoggedIn() {
    var p = AppState.currentProfile;
    var name = (p && p.nickname) ? p.nickname : '사용자';
    var email = (p && p.email) ? p.email : '';

    var loginBtn = document.getElementById('loginNavBtn');
    var avatar = document.getElementById('userAvatar');
    if (loginBtn) loginBtn.style.display = 'none';
    if (avatar) { avatar.style.display = 'flex'; avatar.textContent = name[0].toUpperCase(); }

    var pName = document.getElementById('profileName');
    var pEmail = document.getElementById('profileEmail');
    if (pName) pName.textContent = name;
    if (pEmail) pEmail.textContent = email;

    var bizN = document.getElementById('biz-sidebar-name');
    var perN = document.getElementById('personal-sidebar-name');
    if (bizN) bizN.textContent = name;
    if (perN) perN.textContent = name;
}

function updateUILoggedOut() {
    var loginBtn = document.getElementById('loginNavBtn');
    var avatar = document.getElementById('userAvatar');
    if (loginBtn) loginBtn.style.display = 'flex';
    if (avatar) avatar.style.display = 'none';
}

// ── 네비게이션 ─────────────────────────────────────────
function navigateTo(page) {
    document.querySelectorAll('.page-section').forEach(function(el) {
        el.classList.remove('active');
    });
    var target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');

    document.querySelectorAll('#mainNav button').forEach(function(b) {
        b.classList.remove('active');
    });
    var map = { home:0, 'client-select':1, 'client-business':1, 'client-personal':1, marketplace:2 };
    var idx = map[page];
    if (idx !== undefined) {
        var btns = document.querySelectorAll('#mainNav button');
        if (btns[idx]) btns[idx].classList.add('active');
    }
    window.scrollTo(0, 0);
}

// ── 탭 관리 ────────────────────────────────────────────
function showBizTab(tab, btn) {
    document.querySelectorAll('#page-client-business .main-content > .tab-content').forEach(function(el) {
        el.classList.remove('active');
    });
    var el = document.getElementById('biz-' + tab);
    if (el) el.classList.add('active');

    document.querySelectorAll('#page-client-business .sidebar-menu button').forEach(function(b) {
        b.classList.remove('active');
    });
    if (btn) {
        btn.classList.add('active');
    } else {
        var map = { dashboard:0, create:1, manage:2, 'recent-match':3, payments:4 };
        var btns = document.querySelectorAll('#page-client-business .sidebar-menu button');
        if (btns[map[tab]]) btns[map[tab]].classList.add('active');
    }

    if (tab === 'manage') loadMyRequests('business');
    if (tab === 'recent-match') loadMatchHistoryBiz();
    if (tab === 'dashboard') loadBizDashboard();
}

function showPersonalTab(tab, btn) {
    document.querySelectorAll('#page-client-personal .main-content > .tab-content').forEach(function(el) {
        el.classList.remove('active');
    });
    var el = document.getElementById('personal-' + tab);
    if (el) el.classList.add('active');

    document.querySelectorAll('#page-client-personal .sidebar-menu button').forEach(function(b) {
        b.classList.remove('active');
    });
    if (btn) {
        btn.classList.add('active');
    } else {
        var map = { dashboard:0, individual:1, group:2, myorders:3, 'recent-match':4, payments:5 };
        var btns = document.querySelectorAll('#page-client-personal .sidebar-menu button');
        if (btns[map[tab]]) btns[map[tab]].classList.add('active');
    }

    if (tab === 'myorders') loadMyRequests('personal');
    if (tab === 'recent-match') loadMatchHistoryPersonal();
    if (tab === 'dashboard') loadPersonalDashboard();
}

// ── 대시보드 통계 ──────────────────────────────────────
async function loadBizDashboard() {
    if (!AppState.currentUser) return;
    var requests = await Requests.getMyRequests();
    var biz = requests.filter(function(r) { return r.request_type === 'business'; });
    setEl('biz-count-all', biz.length);
    setEl('biz-count-bidding', biz.filter(function(r){ return r.status==='bidding'; }).length);
    setEl('biz-count-producing', biz.filter(function(r){ return r.status==='producing'; }).length);
    setEl('biz-count-completed', biz.filter(function(r){ return r.status==='completed'; }).length);
}

async function loadPersonalDashboard() {
    if (!AppState.currentUser) return;
    var requests = await Requests.getMyRequests();
    var per = requests.filter(function(r) { return r.request_type === 'personal' || r.request_type === 'group'; });
    setEl('per-count-all', per.length);
    setEl('per-count-bidding', per.filter(function(r){ return r.status==='bidding' && r.request_type==='personal'; }).length);
    setEl('per-count-group', per.filter(function(r){ return r.request_type==='group'; }).length);
    setEl('per-count-completed', per.filter(function(r){ return r.status==='completed'; }).length);
}

function setEl(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ── 의뢰 목록 로드 ─────────────────────────────────────
async function loadMyRequests(type) {
    var containerId = type === 'business' ? 'biz-manage-list' : 'personal-myorders-list';
    var container = document.getElementById(containerId);
    if (!container) return;

    if (!AppState.currentUser) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔐</div><p>로그인 후 의뢰를 확인할 수 있습니다.</p><button class="btn btn-primary" onclick="openModal(\'loginModal\')">로그인</button></div>';
        return;
    }

    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>로딩 중...</p></div>';

    try {
        var all = await Requests.getMyRequests();
        var list = all.filter(function(r) {
            return type === 'business'
                ? r.request_type === 'business'
                : (r.request_type === 'personal' || r.request_type === 'group');
        });

        if (list.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>아직 등록된 의뢰가 없습니다.</p><button class="btn btn-primary" onclick="' + (type==='business' ? "showBizTab('create',null)" : "showPersonalTab('individual',null)") + '">첫 의뢰 만들기</button></div>';
            return;
        }

        container.innerHTML = list.map(function(r) { return renderRequestCard(r); }).join('');
    } catch(e) {
        console.error(e);
        container.innerHTML = '<div class="empty-state"><p>오류가 발생했습니다: ' + e.message + '</p></div>';
    }
}

// ── 의뢰 카드 렌더링 ───────────────────────────────────
function renderRequestCard(req) {
    var statusMap = {
        draft:     { label:'임시저장',      cls:'status-draft' },
        bidding:   { label:'입찰중',        cls:'status-bidding' },
        matched:   { label:'매칭완료',      cls:'status-matched' },
        producing: { label:'제작 진행중',   cls:'status-producing' },
        shipping:  { label:'배송중',        cls:'status-shipping' },
        completed: { label:'배송 완료',     cls:'status-completed' },
        cancelled: { label:'취소됨',        cls:'status-draft' }
    };
    var s = statusMap[req.status] || { label: req.status, cls: '' };
    var bids = req.bids ? req.bids.slice().sort(function(a, b) { return a.unit_price - b.unit_price; }) : [];
    var bidCount = bids.length;
    var createdDate = new Date(req.created_at).toLocaleDateString('ko-KR');

    // 마감일 D-day 계산
    var deadlineText = '';
    if (req.bid_deadline) {
        var diff = Math.ceil((new Date(req.bid_deadline) - new Date()) / 86400000);
        deadlineText = req.bid_deadline + (diff >= 0 ? ' (D-' + diff + ')' : ' (마감)');
    }

    // 입찰 현황 HTML
    var bidsHtml = '';
    if (req.status === 'bidding' && bidCount > 0) {
        var rankCls = ['gold', 'silver', 'bronze'];
        bidsHtml = '<div class="divider"></div>' +
            '<h5 class="mb-8">📊 입찰 현황 (' + bidCount + '건)</h5>' +
            bids.slice(0, 3).map(function(bid, i) {
                return '<div class="bid-item ' + (i === 0 ? 'top-bid' : '') + '">' +
                    '<div class="bid-info">' +
                    '<div class="bid-rank ' + (rankCls[i] || '') + '">' + (i + 1) + '</div>' +
                    '<div><strong>' + escHtml(bid.manufacturer_name || '생산자') + '</strong>' +
                    '<p class="text-xs text-muted">납기 ' + (bid.delivery_days || '-') + '일</p></div>' +
                    '</div>' +
                    '<div style="display:flex;align-items:center;gap:12px">' +
                    '<div class="bid-price">' + bid.unit_price.toLocaleString() + '원</div>' +
                    '<button class="btn ' + (i === 0 ? 'btn-success' : 'btn-outline') + ' btn-sm" ' +
                    'onclick="confirmSelectBid(\'' + req.id + '\',\'' + bid.id + '\',\'' + escHtml(bid.manufacturer_name || '') + '\',' + bid.unit_price + ')">' +
                    (i === 0 ? '✓ 선택' : 'Override') + '</button>' +
                    '</div></div>';
            }).join('') +
            '<p class="text-xs text-muted mt-8">⚠️ 마감일 경과 시 최저가 입찰자에게 자동 매칭됩니다.</p>';
    } else if (req.status === 'bidding' && bidCount === 0) {
        bidsHtml = '<div class="alert alert-info" style="margin-top:12px"><span>⏳</span><span>아직 입찰한 생산자가 없습니다.</span></div>';
    }

    // 공동구매 진행률
    var groupHtml = '';
    if (req.request_type === 'group' && req.min_quantity) {
        var pct = Math.min(100, Math.round((req.current_quantity || 0) / req.min_quantity * 100));
        groupHtml = '<div class="co-purchase-info">' +
            '<div class="flex-between"><span>모집 현황</span><strong>' + (req.current_quantity || 0) + ' / ' + req.min_quantity + '개 (최소)</strong></div>' +
            '<div class="progress-bar mt-8"><div class="fill" style="width:' + pct + '%"></div></div>' +
            '<p class="text-xs text-muted mt-8">최소 수량까지 ' + Math.max(0, req.min_quantity - (req.current_quantity || 0)) + '개 남음</p>' +
            '</div>';
    }

    return '<div class="request-card" data-status="' + req.status + '" data-request-type="' + req.request_type + '" data-id="' + req.id + '">' +
        '<div class="request-card-header">' +
        '<h4>' + (req.request_type === 'group' ? '👥 ' : '') + escHtml(req.title) + '</h4>' +
        '<span class="status-badge ' + s.cls + '">' + s.label + (req.status === 'bidding' ? ' (' + bidCount + '명)' : '') + '</span>' +
        '</div>' +
        '<div class="request-meta">' +
        '<div class="meta-item">📦 수량: <strong>' + req.quantity.toLocaleString() + '개</strong></div>' +
        '<div class="meta-item">💰 희망 단가: <strong>' + req.target_price.toLocaleString() + '원</strong></div>' +
        (deadlineText ? '<div class="meta-item">📅 마감: <strong>' + deadlineText + '</strong></div>' : '') +
        '<div class="meta-item">🗓 등록: <strong>' + createdDate + '</strong></div>' +
        '</div>' +
        groupHtml +
        bidsHtml +
        '<div class="request-actions">' +
        '<button class="btn btn-sm btn-secondary" onclick="openRequestDetail(\'' + req.id + '\')">📋 상세 보기</button>' +
        (req.status === 'bidding' ? '<button class="btn btn-sm btn-danger" onclick="cancelRequest(\'' + req.id + '\')">취소</button>' : '') +
        (req.status === 'completed' ? '<button class="btn btn-sm btn-primary" onclick="openModal(\'writeReviewModal\')">✍️ 후기 작성</button>' : '') +
        '</div>' +
        '</div>';
}

// ── 의뢰 상세 보기 ─────────────────────────────────────
async function openRequestDetail(requestId) {
    openModal('requestDetailModal');
    var body = document.getElementById('detail-modal-body');
    var titleEl = document.getElementById('detail-modal-title');
    if (body) body.innerHTML = '<div style="text-align:center;padding:40px"><div style="font-size:32px">⏳</div><p>로딩 중...</p></div>';

    try {
        var req = await Requests.getById(requestId);
        if (!req) throw new Error('의뢰를 찾을 수 없습니다.');

        if (titleEl) titleEl.textContent = '📋 ' + req.title;

        var statusMap = {
            draft:'임시저장', bidding:'입찰중', matched:'매칭완료',
            producing:'제작 진행중', shipping:'배송중', completed:'배송 완료', cancelled:'취소됨'
        };
        var typeMap = { business:'사업자 의뢰', personal:'개인 의뢰', group:'공동구매 의뢰' };
        var bids = req.bids ? req.bids.slice().sort(function(a,b){ return a.unit_price - b.unit_price; }) : [];
        var files = req.request_files || [];

        var bidsSection = '';
        if (bids.length > 0) {
            bidsSection = '<div class="divider"></div><h5 style="margin-bottom:12px">📊 입찰 목록 (' + bids.length + '건)</h5>' +
                bids.map(function(bid, i) {
                    var rankCls = ['gold','silver','bronze'];
                    return '<div class="bid-item ' + (i===0?'top-bid':'') + '">' +
                        '<div class="bid-info">' +
                        '<div class="bid-rank ' + (rankCls[i]||'') + '">' + (i+1) + '</div>' +
                        '<div><strong>' + escHtml(bid.manufacturer_name||'생산자') + '</strong>' +
                        '<p class="text-xs text-muted">납기 ' + (bid.delivery_days||'-') + '일' +
                        (bid.note ? ' · ' + escHtml(bid.note) : '') + '</p></div>' +
                        '</div>' +
                        '<div style="display:flex;align-items:center;gap:12px">' +
                        '<div><div class="bid-price">' + bid.unit_price.toLocaleString() + '원</div>' +
                        '<div class="text-xs text-muted">총 ' + (bid.unit_price * req.quantity).toLocaleString() + '원</div></div>' +
                        (req.status === 'bidding' ?
                            '<button class="btn ' + (i===0?'btn-success':'btn-outline') + ' btn-sm" onclick="closeModal(\'requestDetailModal\');confirmSelectBid(\'' + req.id + '\',\'' + bid.id + '\',\'' + escHtml(bid.manufacturer_name||'') + '\',' + bid.unit_price + ')">' +
                            (i===0?'✓ 선택':'Override') + '</button>' : '') +
                        '</div></div>';
                }).join('');
        } else {
            bidsSection = '<div class="divider"></div><div class="alert alert-info"><span>⏳</span><span>아직 입찰한 생산자가 없습니다.</span></div>';
        }

        var filesSection = '';
        if (files.length > 0) {
            filesSection = '<div class="divider"></div><h5 style="margin-bottom:8px">📎 첨부 파일</h5>' +
                files.map(function(f) {
                    return '<div style="padding:8px 12px;background:var(--bg);border-radius:6px;margin-bottom:4px;font-size:13px">' +
                        '<a href="' + f.file_url + '" target="_blank" style="color:var(--primary)">📎 ' + escHtml(f.file_name) + '</a></div>';
                }).join('');
        }

        body.innerHTML =
            '<table class="data-table mb-16">' +
            '<tr><td style="width:120px;font-weight:600">의뢰 유형</td><td>' + (typeMap[req.request_type]||req.request_type) + '</td></tr>' +
            '<tr><td style="font-weight:600">카테고리</td><td>' + escHtml(req.category) + '</td></tr>' +
            '<tr><td style="font-weight:600">수량</td><td>' + req.quantity.toLocaleString() + '개</td></tr>' +
            '<tr><td style="font-weight:600">희망 단가</td><td>' + req.target_price.toLocaleString() + '원</td></tr>' +
            '<tr><td style="font-weight:600">예상 총액</td><td class="text-primary fw-bold">' + (req.quantity * req.target_price).toLocaleString() + '원</td></tr>' +
            (req.bid_deadline ? '<tr><td style="font-weight:600">입찰 마감일</td><td>' + req.bid_deadline + '</td></tr>' : '') +
            '<tr><td style="font-weight:600">상태</td><td>' + (statusMap[req.status]||req.status) + '</td></tr>' +
            '<tr><td style="font-weight:600">등록일</td><td>' + new Date(req.created_at).toLocaleString('ko-KR') + '</td></tr>' +
            (req.design_guide ? '<tr><td style="font-weight:600">디자인 가이드</td><td style="white-space:pre-wrap">' + escHtml(req.design_guide) + '</td></tr>' : '') +
            (req.detail_note ? '<tr><td style="font-weight:600">상세 요청</td><td style="white-space:pre-wrap">' + escHtml(req.detail_note) + '</td></tr>' : '') +
            '</table>' +
            bidsSection +
            filesSection +
            '<div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px">' +
            (req.status === 'bidding' ? '<button class="btn btn-danger btn-sm" onclick="closeModal(\'requestDetailModal\');cancelRequest(\'' + req.id + '\')">의뢰 취소</button>' : '') +
            '<button class="btn btn-secondary" onclick="closeModal(\'requestDetailModal\')">닫기</button>' +
            '</div>';

    } catch(e) {
        console.error(e);
        if (body) body.innerHTML = '<div class="empty-state"><p>오류: ' + e.message + '</p></div>';
    }
}

// ── 매칭 이력 로드 ─────────────────────────────────────
async function loadMatchHistoryBiz() {
    var tbody = document.getElementById('biz-match-tbody');
    if (!tbody) return;
    try {
        var list = await Requests.getMatchHistory('business', 20);
        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--gray)">매칭 이력이 없습니다.</td></tr>';
            return;
        }
        tbody.innerHTML = list.map(function(h) {
            var saving = h.target_price > 0 ? Math.round((1 - h.matched_price / h.target_price) * 100) : 0;
            return '<tr>' +
                '<td><strong>' + escHtml(h.title) + '</strong></td>' +
                '<td>' + (h.category||'-') + '</td>' +
                '<td>' + (h.quantity||0).toLocaleString() + '개</td>' +
                '<td>' + (h.target_price||0).toLocaleString() + '원</td>' +
                '<td class="text-success fw-bold">' + (h.matched_price||0).toLocaleString() + '원</td>' +
                '<td class="text-success">▼' + saving + '%</td>' +
                '<td>' + new Date(h.matched_at).toLocaleDateString('ko-KR') + '</td>' +
                '</tr>';
        }).join('');
    } catch(e) { console.error(e); }
}

async function loadMatchHistoryPersonal() {
    var tbody = document.getElementById('personal-match-tbody');
    if (!tbody) return;
    try {
        var list = await Requests.getMatchHistory(null, 20);
        var filtered = list.filter(function(h) { return h.request_type !== 'business'; });
        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray)">매칭 이력이 없습니다.</td></tr>';
            return;
        }
        var tMap = { personal:'개인', group:'공동구매' };
        tbody.innerHTML = filtered.map(function(h) {
            var cls = h.request_type === 'group' ? 'status-recruiting' : 'status-completed';
            return '<tr>' +
                '<td><strong>' + escHtml(h.title) + '</strong></td>' +
                '<td>' + (h.quantity||0).toLocaleString() + '개</td>' +
                '<td>' + (h.target_price||0).toLocaleString() + '원</td>' +
                '<td class="text-success fw-bold">' + (h.matched_price||0).toLocaleString() + '원</td>' +
                '<td><span class="status-badge ' + cls + '">' + (tMap[h.request_type]||h.request_type) + '</span></td>' +
                '<td>' + new Date(h.matched_at).toLocaleDateString('ko-KR') + '</td>' +
                '</tr>';
        }).join('');
    } catch(e) { console.error(e); }
}

// ── 의뢰 생성 ──────────────────────────────────────────
async function submitBizRequest() {
    if (!AppState.currentUser) { openModal('loginModal'); return; }
    var btn = document.getElementById('biz-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = '등록 중...'; }
    try {
        var data = {
            request_type: 'business',
            title:        document.getElementById('biz-title').value.trim(),
            category:     document.getElementById('biz-category').value,
            quantity:     parseInt(document.getElementById('biz-qty').value),
            target_price: parseInt(document.getElementById('biz-price').value),
            bid_deadline: document.getElementById('biz-deadline').value || null,
            design_guide: document.getElementById('biz-design-guide').value,
            detail_note:  document.getElementById('biz-detail-note').value,
            status:       'bidding',
            bidding_type: 'bidding'
        };
        await Requests.create(data);
        showToast('의뢰가 등록되었습니다! 🎉', 'success');
        resetBizForm();
        setTimeout(function() { showBizTab('manage', null); }, 600);
    } catch(e) {
        showToast('오류: ' + e.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🚀 의뢰 등록'; }
    }
}

async function submitPersonalRequest() {
    if (!AppState.currentUser) { openModal('loginModal'); return; }
    var qty   = parseInt(document.getElementById('personalQty').value) || 0;
    var price = parseInt(document.getElementById('personalPrice').value) || 0;
    var name  = document.getElementById('personalItemName').value.trim();
    if (!name || !qty || !price) { showToast('필수 항목을 모두 입력해주세요.', 'error'); return; }

    var reasons = [];
    if (qty > 50)              reasons.push('📦 수량 ' + qty + '개는 공동구매로 진행하면 더 유리합니다.');
    if (price > 0 && price < 1500) reasons.push('💰 희망 단가(' + price.toLocaleString() + '원)가 낮습니다. 공동구매를 고려해보세요.');

    if (reasons.length > 0) {
        document.getElementById('coPurchaseReason').innerHTML =
            reasons.map(function(r) { return '<p class="text-sm" style="margin-bottom:8px">' + r + '</p>'; }).join('');
        openModal('coPurchasePopup');
        return;
    }
    await doSubmitPersonalRequest();
}

async function doSubmitPersonalRequest() {
    var typeEl = document.querySelector('input[name="request-type"]:checked');
    var bType  = typeEl ? typeEl.value : 'bidding';
    try {
        var data = {
            request_type: 'personal',
            title:        document.getElementById('personalItemName').value.trim(),
            category:     document.getElementById('personalCategory').value,
            quantity:     parseInt(document.getElementById('personalQty').value),
            target_price: parseInt(document.getElementById('personalPrice').value),
            bid_deadline: document.getElementById('personalDeadline').value || null,
            design_guide: document.getElementById('personalDesignGuide').value,
            detail_note:  document.getElementById('personalDetailNote').value,
            bidding_type: bType,
            direct_manufacturer_id: bType === 'direct' ? document.getElementById('directMfgId').value : null,
            status: 'bidding'
        };
        await Requests.create(data);
        showToast('개인 의뢰가 등록되었습니다! 🎉', 'success');
        setTimeout(function() { showPersonalTab('myorders', null); }, 600);
    } catch(e) { showToast('오류: ' + e.message, 'error'); }
}

async function submitGroupRequest() {
    if (!AppState.currentUser) { openModal('loginModal'); return; }
    var title    = document.getElementById('group-title').value.trim();
    var category = document.getElementById('group-category').value;
    var totalQty = parseInt(document.getElementById('group-total-qty').value) || 0;
    var minQty   = parseInt(document.getElementById('group-min-qty').value) || 0;
    var price    = parseInt(document.getElementById('group-price').value) || 0;
    if (!title || !category || !totalQty || !minQty || !price) {
        showToast('필수 항목을 모두 입력해주세요.', 'error'); return;
    }
    try {
        var gTypeEl = document.querySelector('input[name="group-type"]:checked');
        var data = {
            request_type:    'group',
            title:           title,
            category:        category,
            quantity:        totalQty,
            min_quantity:    minQty,
            target_price:    price,
            recruit_deadline: document.getElementById('group-recruit-deadline').value || null,
            bid_deadline:    document.getElementById('group-bid-deadline').value || null,
            design_guide:    document.getElementById('group-design-guide').value,
            detail_note:     document.getElementById('group-detail-note').value,
            current_quantity: 0,
            status:          'bidding',
            bidding_type:    gTypeEl ? gTypeEl.value : 'bidding'
        };
        await Requests.create(data);
        showToast('공동제작 의뢰가 등록되었습니다! 🎉', 'success');
        setTimeout(function() { showPersonalTab('myorders', null); }, 600);
    } catch(e) { showToast('오류: ' + e.message, 'error'); }
}

// ── 매칭 확정 ──────────────────────────────────────────
function confirmSelectBid(requestId, bidId, manufacturerName, unitPrice) {
    AppState.pendingMatch = { requestId: requestId, bidId: bidId, name: manufacturerName, price: unitPrice };
    var amountEl = document.getElementById('matchPayAmount');
    var detailEl = document.getElementById('matchPayDetail');
    if (amountEl) amountEl.textContent = '계산 중...';
    if (detailEl) detailEl.textContent = '';
    Requests.getById(requestId).then(function(req) {
        if (req && amountEl) {
            amountEl.textContent = (req.quantity * unitPrice).toLocaleString() + '원';
            if (detailEl) detailEl.textContent = req.title + ' ' + req.quantity.toLocaleString() + '개 × ' + unitPrice.toLocaleString() + '원 (' + manufacturerName + ')';
        }
    });
    openModal('matchConfirmModal');
}

async function executeSelectBid() {
    var pm = AppState.pendingMatch;
    if (!pm.requestId || !pm.bidId) { showToast('오류: 매칭 정보가 없습니다.', 'error'); return; }
    var btn = document.getElementById('matchConfirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = '처리 중...'; }
    try {
        await Requests.selectBid(pm.requestId, pm.bidId, pm.name, pm.price);
        closeModal('matchConfirmModal');
        AppState.pendingMatch = {};
        showToast('매칭이 확정되었습니다! 🎉', 'success');
        loadMyRequests('business');
        loadMyRequests('personal');
    } catch(e) {
        showToast('오류: ' + e.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '💳 결제 및 매칭 확정'; }
    }
}

// ── 의뢰 취소 ──────────────────────────────────────────
async function cancelRequest(requestId) {
    if (!confirm('정말로 이 의뢰를 취소하시겠습니까?')) return;
    try {
        await Requests.cancel(requestId);
        showToast('의뢰가 취소되었습니다.', 'info');
        loadMyRequests('business');
        loadMyRequests('personal');
    } catch(e) { showToast('오류: ' + e.message, 'error'); }
}

// ── 로그인 / 회원가입 / 로그아웃 ──────────────────────
async function handleLogin() {
    var email    = document.getElementById('loginEmail').value.trim();
    var password = document.getElementById('loginPassword').value;
    if (!email || !password) { showToast('이메일과 비밀번호를 입력하세요.', 'error'); return; }
    var btn = document.getElementById('loginSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = '로그인 중...'; }
    try {
        await Auth.signIn(email, password);
        closeModal('loginModal');
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        showToast('로그인되었습니다! 환영합니다 😊', 'success');
    } catch(e) {
        showToast('로그인 실패: ' + e.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '로그인'; }
    }
}

async function handleSignUp() {
    var email    = document.getElementById('signupEmail').value.trim();
    var password = document.getElementById('signupPassword').value;
    var nickname = document.getElementById('signupNickname').value.trim();
    var userType = document.getElementById('signupUserType').value;
    if (!email || !password || !nickname || !userType) { showToast('모든 항목을 입력해주세요.', 'error'); return; }
    if (password.length < 6) { showToast('비밀번호는 6자 이상이어야 합니다.', 'error'); return; }
    var btn = document.getElementById('signupSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = '가입 중...'; }
    try {
        await Auth.signUp(email, password, nickname, userType);
        closeModal('signupModal');
        showToast('회원가입 완료! 이메일 인증 후 로그인해주세요.', 'success');
    } catch(e) {
        showToast('회원가입 실패: ' + e.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '회원가입'; }
    }
}

async function handleLogout() {
    closeDropdown();
    try {
        await Auth.signOut();
        AppState.currentUser = null;
        AppState.currentProfile = null;
        updateUILoggedOut();
        showToast('로그아웃 되었습니다.', 'success');
        navigateTo('home');
    } catch(e) {
        showToast('로그아웃 오류: ' + e.message, 'error');
    }
}

// ── 스텝 관리 ──────────────────────────────────────────
function bizStepNext(step) {
    if (step === 1) {
        var valid = true;
        [['fg-biz-title','biz-title'],['fg-biz-category','biz-category'],
         ['fg-biz-qty','biz-qty'],['fg-biz-price','biz-price'],['fg-biz-deadline','biz-deadline']
        ].forEach(function(p) {
            var el = document.getElementById(p[1]);
            var fg = document.getElementById(p[0]);
            if (el && !el.value.trim()) { if(fg) fg.classList.add('error'); valid = false; }
            else { if(fg) fg.classList.remove('error'); }
        });
        if (!valid) { showToast('필수 항목을 입력해주세요.', 'error'); return; }
    }
    document.getElementById('biz-step-' + step).style.display = 'none';
    document.getElementById('biz-step-' + (step + 1)).style.display = 'block';
    AppState.bizCurrentStep = step + 1;
    updateBizStepper();
    if (step === 2) populateBizConfirm();
}

function bizStepBack(step) {
    document.getElementById('biz-step-' + step).style.display = 'none';
    document.getElementById('biz-step-' + (step - 1)).style.display = 'block';
    AppState.bizCurrentStep = step - 1;
    updateBizStepper();
}

function updateBizStepper() {
    document.querySelectorAll('#bizStepper .step').forEach(function(s, i) {
        s.classList.remove('active', 'done');
        if (i + 1 < AppState.bizCurrentStep) s.classList.add('done');
        else if (i + 1 === AppState.bizCurrentStep) s.classList.add('active');
    });
    document.querySelectorAll('#bizStepper .step-line').forEach(function(l, i) {
        l.classList.toggle('done', i + 1 < AppState.bizCurrentStep);
    });
}

function populateBizConfirm() {
    var qty   = document.getElementById('biz-qty').value;
    var price = document.getElementById('biz-price').value;
    setEl('confirm-title',    document.getElementById('biz-title').value);
    setEl('confirm-category', document.getElementById('biz-category').value);
    setEl('confirm-qty',      Number(qty).toLocaleString() + '개');
    setEl('confirm-price',    Number(price).toLocaleString() + '원');
    setEl('confirm-deadline', document.getElementById('biz-deadline').value);
    setEl('confirm-total',    (Number(qty) * Number(price)).toLocaleString() + '원');
    setEl('confirm-guide',    document.getElementById('biz-design-guide').value || '-');
    setEl('confirm-note',     document.getElementById('biz-detail-note').value || '-');
    var fi = document.getElementById('biz-file-input');
    setEl('confirm-files', fi && fi.files.length > 0 ? Array.from(fi.files).map(function(f){return f.name;}).join(', ') : '없음');
}

function resetBizForm() {
    ['biz-title','biz-qty','biz-price','biz-deadline','biz-design-guide','biz-detail-note'].forEach(function(id) {
        var el = document.getElementById(id); if(el) el.value = '';
    });
    var cat = document.getElementById('biz-category'); if(cat) cat.value = '';
    document.getElementById('biz-step-3').style.display = 'none';
    document.getElementById('biz-step-2').style.display = 'none';
    document.getElementById('biz-step-1').style.display = 'block';
    AppState.bizCurrentStep = 1;
    updateBizStepper();
}

// ── 필터 ───────────────────────────────────────────────
function filterBizStatus(status, btn) {
    if (btn) {
        document.querySelectorAll('#biz-status-pills .pill-filter').forEach(function(p){ p.classList.remove('active'); });
        btn.classList.add('active');
    }
    document.querySelectorAll('#biz-manage-list .request-card').forEach(function(card) {
        card.style.display = (status === 'all' || card.dataset.status === status) ? 'block' : 'none';
    });
}

function filterPersonalStatus(status, btn) {
    if (btn) {
        document.querySelectorAll('#personal-status-pills .pill-filter').forEach(function(p){ p.classList.remove('active'); });
        btn.classList.add('active');
    }
    document.querySelectorAll('#personal-myorders-list .request-card').forEach(function(card) {
        var show = false;
        if (status === 'all') show = true;
        else if (status === 'group') show = card.dataset.requestType === 'group';
        else show = card.dataset.status === status;
        card.style.display = show ? 'block' : 'none';
    });
}

function filterPillActive(btn) {
    btn.parentElement.querySelectorAll('.pill-filter').forEach(function(p){ p.classList.remove('active'); });
    btn.classList.add('active');
}

// ── 기타 UI 함수 ───────────────────────────────────────
function toggleDirectMfg(radio) {
    var field = document.getElementById('directMfgField');
    if (field) field.style.display = radio.value === 'direct' ? 'block' : 'none';
    var rb = document.getElementById('radio-bidding');
    var rd = document.getElementById('radio-direct');
    if (rb) rb.style.borderColor = radio.value === 'bidding' ? 'var(--primary)' : '#E2E8F0';
    if (rd) rd.style.borderColor = radio.value === 'direct'  ? 'var(--primary)' : '#E2E8F0';
}

function toggleGroupDirectMfg(radio) {
    var field = document.getElementById('groupDirectMfgField');
    if (field) field.style.display = radio.value === 'direct' ? 'block' : 'none';
}

function showUploadedFiles(input, listId) {
    var list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = '';
    Array.from(input.files).forEach(function(f) {
        var div = document.createElement('div');
        div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg);border-radius:6px;margin-bottom:4px;font-size:13px';
        div.innerHTML = '<span>📎 ' + escHtml(f.name) + ' (' + (f.size/1024/1024).toFixed(1) + 'MB)</span>' +
            '<button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px">×</button>';
        list.appendChild(div);
    });
}

function setRating(n) {
    document.querySelectorAll('#starRating span').forEach(function(s, i) {
        s.style.opacity = i < n ? '1' : '0.3';
    });
}

function openModal(id)  { var el = document.getElementById(id); if(el) el.classList.add('show'); }
function closeModal(id) { var el = document.getElementById(id); if(el) el.classList.remove('show'); }

function closeDropdown() {
    var d = document.getElementById('profileDropdown');
    if (d) d.classList.remove('show');
}

function toggleUserMenu(event) {
    if (event) event.stopPropagation();
    var d = document.getElementById('profileDropdown');
    if (d) d.classList.toggle('show');
}

function showToast(message, type) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast ' + (type || 'info') + ' show';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function(){ toast.classList.remove('show'); }, 3000);
}

// XSS 방지
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#039;');
}

// 클릭 외부 시 드롭다운 닫기
document.addEventListener('click', function(e) {
    var d = document.getElementById('profileDropdown');
    if (d && d.classList.contains('show') && !e.target.closest('.nav-user')) {
        d.classList.remove('show');
    }
});

// 앱 시작
document.addEventListener('DOMContentLoaded', initApp);
