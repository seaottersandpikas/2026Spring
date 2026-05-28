var AppState = {
    currentUser:    null,
    currentProfile: null,
    bizCurrentStep: 1,
    pendingMatch:   {},
    mfgType:        'factory',
    priceHints: {
        '아크릴굿즈':'1,800~3,500원','의류/패브릭':'7,000~25,000원',
        '문구/스티커':'300~1,500원','패키징':'800~3,000원',
        '봉제인형':'10,000~30,000원','금속/뱃지':'2,000~5,000원',
        '생활용품':'3,000~15,000원'
    }
};

var _pendingBidRequestId = null;
var _pendingBidQuantity  = 0;
var _pendingGroupRequestId = null;

// ── 초기화 ─────────────────────────────────────────────
function initApp() {
    if (!window.supabaseClient) {
        showToast('연결 오류. 새로고침해주세요.', 'error');
        return;
    }
    console.log('✅ App 초기화');

    // 인증 상태 변경 → UI 즉시 반영
    Auth.onAuthStateChange(function(event, session) {
        console.log('🔔 Auth 이벤트:', event);
        if (event === 'SIGNED_IN' && session) {
            AppState.currentUser = session.user;
            // 프로필 비동기 로드 (UI 블로킹 없음)
            Auth.getProfile().then(function(p) {
                AppState.currentProfile = p;
                updateUILoggedIn();
            });
        } else if (event === 'SIGNED_OUT') {
            AppState.currentUser    = null;
            AppState.currentProfile = null;
            updateUILoggedOut();
        }
    });

    // 기존 세션 확인
    Auth.getUser().then(function(user) {
        if (user) {
            AppState.currentUser = user;
            Auth.getProfile().then(function(p) {
                AppState.currentProfile = p;
                updateUILoggedIn();
            });
        }
    });

    // 매칭 이력 로드
    loadMatchHistoryBiz();
    loadMatchHistoryPersonal();

    // 카테고리 힌트
    var bizCat = document.getElementById('biz-category');
    if (bizCat) {
        bizCat.addEventListener('change', function() {
            var hint = AppState.priceHints[this.value];
            var el   = document.getElementById('biz-price-hint');
            if (el) el.textContent = hint
                ? '시장 평균 참고가: ' + hint
                : '카테고리를 선택하면 표시됩니다';
        });
    }

    // 모달 오버레이 클릭 닫기
    document.querySelectorAll('.modal-overlay').forEach(function(o) {
        o.addEventListener('click', function(e) {
            if (e.target === this) this.classList.remove('show');
        });
    });
}

// ── UI ─────────────────────────────────────────────────
function updateUILoggedIn() {
    var p     = AppState.currentProfile;
    var name  = (p && p.nickname) ? p.nickname : '사용자';
    var email = (p && p.email)    ? p.email    : '';
    var loginBtn = document.getElementById('loginNavBtn');
    var avatar   = document.getElementById('userAvatar');
    if (loginBtn) loginBtn.style.display = 'none';
    if (avatar)  { avatar.style.display = 'flex'; avatar.textContent = name[0].toUpperCase(); }
    setEl('profileName',           name);
    setEl('profileEmail',          email);
    setEl('biz-sidebar-name',      name);
    setEl('personal-sidebar-name', name);
    setEl('mfg-sidebar-name',      name);
    renderProfileMenu();
    updateNotificationBadge();
    // 로그인 후 현재 활성 페이지가 의뢰 페이지면 즉시 로드
    var bizPage = document.getElementById('page-client-business');
    var perPage = document.getElementById('page-client-personal');
    if (bizPage && bizPage.classList.contains('active')) loadBizDashboard();
    if (perPage && perPage.classList.contains('active')) loadPersonalDashboard();
}

function updateUILoggedOut() {
    var loginBtn = document.getElementById('loginNavBtn');
    var avatar   = document.getElementById('userAvatar');
    if (loginBtn) loginBtn.style.display = 'flex';
    if (avatar)   avatar.style.display   = 'none';
    // 프로필 드롭다운도 닫기
    var dd = document.getElementById('profileDropdown');
    if (dd) dd.classList.remove('show');
}

// ── 로그인 ─────────────────────────────────────────────
async function handleLogin() {
    var email    = document.getElementById('loginEmail').value.trim();
    var password = document.getElementById('loginPassword').value;
    if (!email || !password) { showToast('이메일과 비밀번호를 입력하세요.', 'error'); return; }

    var btn = document.getElementById('loginSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = '로그인 중...'; }

    try {
        await Auth.signIn(email, password);
        // onAuthStateChange → SIGNED_IN 이벤트가 UI 처리
        closeModal('loginModal');
        document.getElementById('loginEmail').value    = '';
        document.getElementById('loginPassword').value = '';
        showToast('로그인되었습니다! 😊', 'success');
    } catch(e) {
        var msg = e.message || '';
        if (msg.includes('Invalid login credentials')) msg = '이메일 또는 비밀번호가 올바르지 않습니다.';
        else if (msg.includes('Email not confirmed'))  msg = '이메일 인증이 필요합니다.';
        else if (msg.includes('Too many requests'))    msg = '잠시 후 다시 시도해주세요.';
        showToast('로그인 실패: ' + msg, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '로그인'; }
    }
}

// ── 회원가입 ───────────────────────────────────────────
async function handleSignUp() {
    var email    = document.getElementById('signupEmail').value.trim();
    var password = document.getElementById('signupPassword').value;
    var nickname = document.getElementById('signupNickname').value.trim();
    var userType = document.getElementById('signupUserType').value;
    if (!email||!password||!nickname||!userType) { showToast('모든 항목을 입력해주세요.','error'); return; }
    if (password.length < 6) { showToast('비밀번호는 6자 이상이어야 합니다.','error'); return; }
    var btn = document.getElementById('signupSubmitBtn');
    if (btn) { btn.disabled=true; btn.textContent='가입 중...'; }
    try {
        await Auth.signUp(email, password, nickname, userType);
        closeModal('signupModal');
        showToast('회원가입 완료! 이메일 인증 후 로그인해주세요.','success');
    } catch(e) {
        showToast('회원가입 실패: '+e.message,'error');
    } finally {
        if (btn) { btn.disabled=false; btn.textContent='회원가입'; }
    }
}

// ── 로그아웃 (즉시 처리) ───────────────────────────────
async function handleLogout() {
    // 1. 즉시 UI 업데이트 (사용자가 바로 느낌)
    AppState.currentUser    = null;
    AppState.currentProfile = null;
    updateUILoggedOut();
    navigateTo('home');
    showToast('로그아웃 되었습니다.', 'success');

    // 2. 백그라운드에서 실제 로그아웃
    try { await Auth.signOut(); } catch(e) { console.warn('signOut 경고:', e.message); }
}

// ── 네비게이션 ─────────────────────────────────────────
function navigateTo(page) {
    var actualPage = page;
    if (page === 'manufacturer-factory')  { AppState.mfgType = 'factory';  actualPage = 'manufacturer'; }
    if (page === 'manufacturer-personal') { AppState.mfgType = 'personal'; actualPage = 'manufacturer'; }

    document.querySelectorAll('.page-section').forEach(function(el){ el.classList.remove('active'); });
    var t = document.getElementById('page-'+actualPage);
    if (t) t.classList.add('active');
    document.querySelectorAll('#mainNav button').forEach(function(b){ b.classList.remove('active'); });
    var map = {
        home:0,
        'manufacturer-select':1,'manufacturer':1,
        'client-select':2,'client-business':2,'client-personal':2,
        marketplace:3
    };
    if (map[actualPage] !== undefined) {
        var btns = document.querySelectorAll('#mainNav button');
        if (btns[map[actualPage]]) btns[map[actualPage]].classList.add('active');
    }
    if (actualPage === 'client-business') loadBizDashboard();
    if (actualPage === 'client-personal') loadPersonalDashboard();
    if (actualPage === 'manufacturer') {
        var typeLabel = AppState.mfgType === 'factory' ? '공장 생산자' : '개인 생산자';
        setEl('mfg-sidebar-type-label', typeLabel);
        var badge = document.getElementById('mfg-type-badge');
        if (badge) badge.textContent = typeLabel;
        if (AppState.currentProfile) setEl('mfg-sidebar-name', AppState.currentProfile.nickname || '사용자');
        loadMfgDashboard();
    }
    if (actualPage === 'marketplace') loadMarketplace();
    window.scrollTo(0,0);
}

// ── 탭 ─────────────────────────────────────────────────
function showBizTab(tab, btn) {
    document.querySelectorAll('#page-client-business .main-content > .tab-content')
        .forEach(function(el){ el.classList.remove('active'); });
    var el = document.getElementById('biz-'+tab);
    if (el) el.classList.add('active');
    document.querySelectorAll('#page-client-business .sidebar-menu button')
        .forEach(function(b){ b.classList.remove('active'); });
    if (btn) { btn.classList.add('active'); }
    else {
        var m = {dashboard:0,create:1,manage:2,'recent-match':3,payments:4};
        var bs = document.querySelectorAll('#page-client-business .sidebar-menu button');
        if (bs[m[tab]]) bs[m[tab]].classList.add('active');
    }
    if (tab==='manage')       loadMyRequests('business');
    if (tab==='recent-match') loadMatchHistoryBiz();
    if (tab==='dashboard')    loadBizDashboard();
    if (tab==='payments')     loadBizPayments();
}

function showPersonalTab(tab, btn) {
    document.querySelectorAll('#page-client-personal .main-content > .tab-content')
        .forEach(function(el){ el.classList.remove('active'); });
    var el = document.getElementById('personal-'+tab);
    if (el) el.classList.add('active');
    document.querySelectorAll('#page-client-personal .sidebar-menu button')
        .forEach(function(b){ b.classList.remove('active'); });
    if (btn) { btn.classList.add('active'); }
    else {
        var m = {dashboard:0,individual:1,group:2,myorders:3,'recent-match':4,payments:5};
        var bs = document.querySelectorAll('#page-client-personal .sidebar-menu button');
        if (bs[m[tab]]) bs[m[tab]].classList.add('active');
    }
    if (tab==='myorders')     loadMyRequestsSplit();
    if (tab==='recent-match') loadMatchHistoryPersonal();
    if (tab==='dashboard')    loadPersonalDashboard();
    if (tab==='payments')     loadPersonalPayments();
}

// ── 대시보드 ───────────────────────────────────────────
async function loadBizDashboard() {
    if (!AppState.currentUser) return;
    try {
        var r = await Requests.getMyRequests();
        var b = r.filter(function(x){ return x.request_type==='business'; });
        setEl('biz-count-all',       b.length);
        setEl('biz-count-bidding',   b.filter(function(x){ return x.status==='bidding'; }).length);
        setEl('biz-count-producing', b.filter(function(x){ return x.status==='producing'; }).length);
        setEl('biz-count-completed', b.filter(function(x){ return x.status==='matched'||x.status==='producing'||x.status==='shipping'||x.status==='completed'; }).length);
    } catch(e){ console.error(e); }
    autoMatchOverdueBids();
    Requests.autoCompleteOverdueShipping().catch(function(e){ console.warn('auto-complete 실패:', e.message); });
}

async function loadPersonalDashboard() {
    if (!AppState.currentUser) return;
    try {
        var r = await Requests.getMyRequests();
        var p = r.filter(function(x){ return x.request_type==='personal'||x.request_type==='group'; });
        setEl('per-count-all',       p.length);
        setEl('per-count-bidding',   p.filter(function(x){ return x.status==='bidding'&&x.request_type==='personal'; }).length);
        setEl('per-count-group',     p.filter(function(x){ return x.request_type==='group'; }).length);
        setEl('per-count-completed', p.filter(function(x){ return x.status==='matched'||x.status==='producing'||x.status==='shipping'||x.status==='completed'; }).length);
    } catch(e){ console.error(e); }
    autoMatchOverdueBids();
    Requests.autoCompleteOverdueShipping().catch(function(e){ console.warn('auto-complete 실패:', e.message); });
}

// ── 의뢰 목록 ──────────────────────────────────────────
async function loadMyRequests(type) {
    var cid       = type==='business' ? 'biz-manage-list' : 'personal-myorders-list';
    var container = document.getElementById(cid);
    if (!container) return;

    if (!AppState.currentUser) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔐</div><p>로그인 후 확인할 수 있습니다.</p><button class="btn btn-primary" onclick="openModal(\'loginModal\')">로그인</button></div>';
        return;
    }
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>로딩 중...</p></div>';

    try {
        var all  = await Requests.getMyRequests();
        var list = all.filter(function(r){
            return type==='business'
                ? r.request_type==='business'
                : (r.request_type==='personal'||r.request_type==='group');
        });
        if (!list.length) {
            var fn = type==='business' ? "showBizTab('create',null)" : "showPersonalTab('individual',null)";
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>아직 등록된 의뢰가 없습니다.</p><button class="btn btn-primary" onclick="'+fn+'">첫 의뢰 만들기</button></div>';
            return;
        }
        container.innerHTML = list.map(renderRequestCard).join('');
    } catch(e) {
        console.error(e);
        container.innerHTML = '<div class="empty-state"><p>오류: '+escHtml(e.message)+'</p></div>';
    }
}

// ── 카드 렌더링 ────────────────────────────────────────
function renderRequestCard(req) {
    var sMap = {
        draft:    {label:'임시저장',    cls:'status-draft'},
        bidding:  {label:'입찰중',      cls:'status-bidding'},
        matched:  {label:'매칭완료',    cls:'status-matched'},
        producing:{label:'제작 진행중', cls:'status-producing'},
        shipping: {label:'배송중',      cls:'status-shipping'},
        completed:{label:'배송 완료',   cls:'status-completed'},
        cancelled:{label:'취소됨',      cls:'status-draft'}
    };
    var s        = sMap[req.status] || {label:req.status, cls:''};
    var bids     = req.bids ? req.bids.slice().sort(function(a,b){return a.unit_price-b.unit_price;}) : [];
    var bidCount = bids.length;
    var created  = new Date(req.created_at).toLocaleDateString('ko-KR');
    var ddText   = '';
    if (req.bid_deadline) {
        var diff = Math.ceil((new Date(req.bid_deadline)-new Date())/86400000);
        ddText = req.bid_deadline+(diff>=0?' (D-'+diff+')':' (마감)');
    }

    // 입찰 현황
    var bidsHtml = '';
    if (req.status==='bidding' && bidCount>0) {
        var rc = ['gold','silver','bronze'];
        bidsHtml = '<div class="divider"></div>' +
            '<h5 class="mb-8">📊 입찰 현황 ('+bidCount+'건) <span class="text-xs text-muted">· 클릭하면 견적 확인</span></h5>' +
            bids.slice(0,3).map(function(bid,i){
                var mk = getMakerInfo(bid);
                return '<div class="bid-item '+(i===0?'top-bid':'')+'" onclick="openBidDetail(\''+bid.id+'\',\''+req.id+'\')" style="cursor:pointer">' +
                    '<div class="bid-info">' +
                    '<div class="bid-rank '+(rc[i]||'')+'">'+(i+1)+'</div>' +
                    '<div><strong>'+escHtml(bid.manufacturer_name||'생산자')+'</strong>' +
                    '<p class="text-xs text-muted">'+escHtml(mk.specialty)+' | ⭐'+mk.rating+' | '+mk.completedCount+'건 완료</p>' +
                    '</div></div>' +
                    '<div style="display:flex;align-items:center;gap:12px">' +
                    '<div><div class="bid-price">'+bid.unit_price.toLocaleString()+'원</div>' +
                    '<div class="text-xs text-muted">납기 '+(bid.delivery_days||'-')+'일</div></div>' +
                    (i===0
                        ? '<button class="btn btn-success btn-sm" onclick="event.stopPropagation();confirmSelectBid(\''+req.id+'\',\''+bid.id+'\',\''+escHtml(bid.manufacturer_name||'')+'\',' +bid.unit_price+')">✓ 선택</button>'
                        : '<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();confirmSelectBid(\''+req.id+'\',\''+bid.id+'\',\''+escHtml(bid.manufacturer_name||'')+'\',' +bid.unit_price+')">Override</button>'
                    ) +
                    '</div></div>';
            }).join('');
        if (bidCount>3) bidsHtml += '<p class="text-xs mt-8" style="text-align:center;cursor:pointer;color:var(--primary)" onclick="openRequestDetail(\''+req.id+'\')">' +(bidCount-3)+'건 더 보기 →</p>';
        bidsHtml += '<p class="text-xs text-muted mt-8">⚠️ 마감일 경과 시 최저가 입찰자에게 자동 매칭됩니다.</p>';
    } else if (req.status==='bidding') {
        bidsHtml = '<div class="alert alert-info" style="margin-top:12px"><span>⏳</span><span>입찰 준비 중입니다.</span></div>';
    }

    // 매칭 완료 상태 표시
    var matchedHtml = '';
    if (req.status==='matched'||req.status==='producing'||req.status==='shipping'||req.status==='completed') {
        var selectedBid = req.bids ? req.bids.find(function(b){return b.status==='selected';}) : null;
        if (selectedBid) {
            matchedHtml = '<div class="alert alert-success" style="margin-top:12px">' +
                '<span>✅</span>' +
                '<div><strong>'+escHtml(selectedBid.manufacturer_name)+'</strong> 와 매칭되었습니다.<br>' +
                '<span class="text-sm">확정 단가: <strong>'+selectedBid.unit_price.toLocaleString()+'원</strong> | 납기: '+(selectedBid.delivery_days||'-')+'일</span>' +
                '</div></div>';
        }
    }

    // 공동구매
    var groupHtml = '';
    if (req.request_type==='group' && req.min_quantity) {
        var pct = Math.min(100,Math.round((req.current_quantity||0)/req.min_quantity*100));
        groupHtml = '<div class="co-purchase-info">' +
            '<div class="flex-between"><span>모집 현황</span><strong>'+(req.current_quantity||0)+' / '+req.min_quantity+'개 (최소)</strong></div>' +
            '<div class="progress-bar mt-8"><div class="fill" style="width:'+pct+'%"></div></div>' +
            '<p class="text-xs text-muted mt-8">최소 수량까지 '+Math.max(0,req.min_quantity-(req.current_quantity||0))+'개 남음</p>' +
            '</div>';
    }

    return '<div class="request-card" data-status="'+req.status+'" data-request-type="'+req.request_type+'" data-id="'+req.id+'">' +
        '<div class="request-card-header">' +
        '<h4>'+(req.request_type==='group'?'👥 ':'')+escHtml(req.title)+'</h4>' +
        '<span class="status-badge '+s.cls+'">'+s.label+(req.status==='bidding'?' ('+bidCount+'명)':'')+'</span>' +
        '</div>' +
        '<div class="request-meta">' +
        '<div class="meta-item">📦 수량: <strong>'+req.quantity.toLocaleString()+'개</strong></div>' +
        '<div class="meta-item">💰 희망 단가: <strong>'+req.target_price.toLocaleString()+'원</strong></div>' +
        (ddText?'<div class="meta-item">📅 마감: <strong>'+ddText+'</strong></div>':'')+
        '<div class="meta-item">🗓 등록: <strong>'+created+'</strong></div>' +
        '</div>' +
        groupHtml + bidsHtml + matchedHtml +
        '<div class="request-actions">' +
        '<button class="btn btn-sm btn-secondary" onclick="openRequestDetail(\''+req.id+'\')">📋 상세 보기</button>' +
        (req.status==='bidding'?'<button class="btn btn-sm btn-danger" onclick="cancelRequest(\''+req.id+'\')">취소</button>':'')+
        (req.status==='completed'?'<button class="btn btn-sm btn-primary" onclick="openReviewModal(\''+req.id+'\')">✍️ 후기 작성</button>':'')+
        '</div></div>';
}

// ── 생산자 정보 헬퍼 ───────────────────────────────────
// Phase 7: bid.manufacturer (profiles join) 우선 사용 → 실제 평점 노출
function getMakerInfo(bid) {
    var m = bid && bid.manufacturer ? bid.manufacturer : null;
    var rating = (m && m.avg_rating != null && m.total_reviews > 0)
        ? Number(m.avg_rating).toFixed(1)
        : '신규';
    var completed = (m && m.completed_count != null)
        ? m.completed_count
        : (bid.manufacturer_completed != null ? bid.manufacturer_completed : 0);
    return {
        specialty:      (m && m.specialty) || bid.manufacturer_specialty || '종합 굿즈',
        rating:         rating,
        completedCount: completed,
        totalReviews:   m ? (m.total_reviews || 0) : 0
    };
}

// ── 입찰 상세 ──────────────────────────────────────────
async function openBidDetail(bidId, requestId) {
    openModal('requestDetailModal');
    var body    = document.getElementById('detail-modal-body');
    var titleEl = document.getElementById('detail-modal-title');
    if (body) body.innerHTML = '<div style="text-align:center;padding:40px"><div style="font-size:32px">⏳</div><p>로딩 중...</p></div>';
    try {
        var req  = await Requests.getById(requestId);
        if (!req) throw new Error('의뢰 정보를 찾을 수 없습니다.');
        var bids = req.bids ? req.bids.slice().sort(function(a,b){return a.unit_price-b.unit_price;}) : [];
        var bid  = bids.find(function(b){return b.id===bidId;});
        if (!bid) throw new Error('입찰 정보를 찾을 수 없습니다.');
        var mk   = getMakerInfo(bid);
        var rank = bids.findIndex(function(b){return b.id===bidId;})+1;
        if (titleEl) titleEl.textContent = '📄 '+escHtml(bid.manufacturer_name)+' 견적서';

        body.innerHTML =
            '<div style="display:flex;align-items:center;gap:12px;background:var(--bg);padding:14px;border-radius:8px;margin-bottom:16px">' +
            '<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px">'+escHtml(bid.manufacturer_name[0])+'</div>' +
            '<div><div style="font-weight:700;font-size:15px">'+escHtml(bid.manufacturer_name)+'</div>' +
            '<div class="text-xs text-muted">'+escHtml(mk.specialty)+' | ⭐'+mk.rating+' | 완료 '+mk.completedCount+'건</div></div>' +
            (rank===1?'<span class="status-badge status-matched" style="margin-left:auto">🏆 최저가</span>':'<span class="status-badge status-bidding" style="margin-left:auto">'+rank+'위</span>')+
            '</div>' +
            '<table class="estimate-table">' +
            '<thead><tr><th>항목</th><th>수량</th><th>단가</th><th>금액</th></tr></thead>' +
            '<tbody>' +
            '<tr><td>'+escHtml(req.title)+' 제작비</td><td>'+req.quantity.toLocaleString()+'개</td><td>'+bid.unit_price.toLocaleString()+'원</td><td>'+(bid.unit_price*req.quantity).toLocaleString()+'원</td></tr>' +
            '<tr><td>포장비</td><td>포함</td><td>-</td><td>-</td></tr>' +
            '<tr><td>배송비</td><td>-</td><td>-</td><td>무료</td></tr>' +
            '</tbody>' +
            '<tfoot><tr style="font-weight:700"><td colspan="3" style="text-align:right">합계</td><td class="text-primary">'+(bid.unit_price*req.quantity).toLocaleString()+'원</td></tr></tfoot>' +
            '</table>' +
            (bid.note?'<div class="alert alert-info mt-16"><span>📝</span><span><strong>생산자 메모:</strong> '+escHtml(bid.note)+'</span></div>':'')+
            '<div style="background:var(--bg);border-radius:8px;padding:12px 16px;margin-top:12px;display:flex;gap:24px;flex-wrap:wrap">' +
            '<div><div class="text-xs text-muted">예상 납기</div><div style="font-weight:700;font-size:16px;color:var(--primary)">'+(bid.delivery_days||'-')+'일</div></div>' +
            '<div><div class="text-xs text-muted">희망 단가 대비</div><div style="font-weight:700;font-size:16px;color:var(--success)">▼'+Math.max(0,Math.round((1-bid.unit_price/req.target_price)*100))+'% 절감</div></div>' +
            '<div><div class="text-xs text-muted">총 결제 예정액</div><div style="font-weight:700;font-size:16px">'+(bid.unit_price*req.quantity).toLocaleString()+'원</div></div>' +
            '</div>' +
            '<div class="divider"></div>' +
            '<h5 style="margin-bottom:10px">다른 입찰 비교 (단가 낮은 순)</h5>' +
            '<div style="display:flex;flex-direction:column;gap:6px">' +
            bids.map(function(b,i){
                var isThis = b.id===bidId;
                return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:'+(isThis?'rgba(108,92,231,0.08)':'var(--bg)')+';border-radius:6px;border:'+(isThis?'1px solid var(--primary-light)':'1px solid transparent')+'">' +
                    '<span class="text-sm"><strong>'+(i+1)+'위</strong> '+escHtml(b.manufacturer_name)+'</span>' +
                    '<div style="display:flex;align-items:center;gap:12px">' +
                    '<span style="font-weight:700;color:var(--primary)">'+b.unit_price.toLocaleString()+'원</span>' +
                    '<span class="text-xs text-muted">납기 '+(b.delivery_days||'-')+'일</span>' +
                    (isThis
                        ? '<span class="text-xs" style="color:var(--primary);font-weight:600">현재 보는 중</span>'
                        : '<button class="btn btn-outline btn-sm" onclick="openBidDetail(\''+b.id+'\',\''+requestId+'\')">보기</button>'
                    )+
                    '</div></div>';
            }).join('')+
            '</div>' +
            '<div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px">' +
            '<button class="btn btn-secondary" onclick="closeModal(\'requestDetailModal\')">닫기</button>' +
            (req.status==='bidding'?'<button class="btn btn-success" onclick="closeModal(\'requestDetailModal\');confirmSelectBid(\''+req.id+'\',\''+bid.id+'\',\''+escHtml(bid.manufacturer_name)+'\',' +bid.unit_price+')">이 견적으로 매칭 →</button>':'')+
            '</div>';
    } catch(e) {
        console.error(e);
        if (body) body.innerHTML = '<div class="empty-state"><p>오류: '+escHtml(e.message)+'</p></div>';
    }
}

// ── 의뢰 상세 ──────────────────────────────────────────
async function openRequestDetail(requestId) {
    openModal('requestDetailModal');
    var body    = document.getElementById('detail-modal-body');
    var titleEl = document.getElementById('detail-modal-title');
    if (body) body.innerHTML = '<div style="text-align:center;padding:40px"><div style="font-size:32px">⏳</div><p>로딩 중...</p></div>';
    try {
        var req = await Requests.getById(requestId);
        if (!req) throw new Error('의뢰를 찾을 수 없습니다.');
        if (titleEl) titleEl.textContent = '📋 '+req.title;
        var sMap={draft:'임시저장',bidding:'입찰중',matched:'매칭완료',producing:'제작 진행중',shipping:'배송중',completed:'배송 완료',cancelled:'취소됨'};
        var tMap={business:'사업자 의뢰',personal:'개인 의뢰',group:'공동구매 의뢰'};
        var bids  = req.bids ? req.bids.slice().sort(function(a,b){return a.unit_price-b.unit_price;}) : [];
        var files = req.request_files||[];

        var bidsSection = bids.length>0
            ? '<div class="divider"></div><h5 style="margin-bottom:12px">📊 전체 입찰 목록 ('+bids.length+'건)</h5>' +
              bids.map(function(bid,i){
                  var mk=getMakerInfo(bid), rc=['gold','silver','bronze'];
                  return '<div class="bid-item '+(i===0?'top-bid':'')+'" onclick="openBidDetail(\''+bid.id+'\',\''+req.id+'\')" style="cursor:pointer">' +
                      '<div class="bid-info"><div class="bid-rank '+(rc[i]||'')+'">'+(i+1)+'</div>' +
                      '<div><strong>'+escHtml(bid.manufacturer_name||'생산자')+'</strong>' +
                      '<p class="text-xs text-muted">'+escHtml(mk.specialty)+' | ⭐'+mk.rating+' | 완료 '+mk.completedCount+'건</p></div></div>' +
                      '<div style="display:flex;align-items:center;gap:12px">' +
                      '<div><div class="bid-price">'+bid.unit_price.toLocaleString()+'원</div>' +
                      '<div class="text-xs text-muted">납기 '+(bid.delivery_days||'-')+'일 · 총 '+(bid.unit_price*req.quantity).toLocaleString()+'원</div></div>' +
                      (req.status==='bidding'
                          ?(i===0
                              ?'<button class="btn btn-success btn-sm" onclick="event.stopPropagation();closeModal(\'requestDetailModal\');confirmSelectBid(\''+req.id+'\',\''+bid.id+'\',\''+escHtml(bid.manufacturer_name||'')+'\',' +bid.unit_price+')">✓ 선택</button>'
                              :'<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();closeModal(\'requestDetailModal\');confirmSelectBid(\''+req.id+'\',\''+bid.id+'\',\''+escHtml(bid.manufacturer_name||'')+'\',' +bid.unit_price+')">Override</button>'
                          ):'')+
                      '</div></div>';
              }).join('')
            : '<div class="divider"></div><div class="alert alert-info"><span>⏳</span><span>아직 입찰한 생산자가 없습니다.</span></div>';

        var filesSection = files.length>0
            ? '<div class="divider"></div><h5 style="margin-bottom:8px">📎 첨부 파일</h5>'+
              files.map(function(f){return '<div style="padding:8px 12px;background:var(--bg);border-radius:6px;margin-bottom:4px;font-size:13px"><a href="'+f.file_url+'" target="_blank" style="color:var(--primary)">📎 '+escHtml(f.file_name)+'</a></div>';}).join('')
            : '';

        // Phase 4: 결제·배송 정보 섹션
        var txnRows = '';
        if (req.payment_status && req.payment_status !== 'unpaid') {
            txnRows += '<div class="divider"></div><h5 style="margin-bottom:12px">💳 결제 / 배송 정보</h5>' +
                '<table class="data-table mb-16">' +
                (req.paid_at?'<tr><td style="width:120px;font-weight:600">결제일</td><td>'+new Date(req.paid_at).toLocaleString('ko-KR')+'</td></tr>':'')+
                (req.payment_method?'<tr><td style="font-weight:600">결제 방법</td><td>'+escHtml(req.payment_method)+'</td></tr>':'')+
                (req.payment_amount?'<tr><td style="font-weight:600">결제 금액</td><td class="text-primary fw-bold">'+Number(req.payment_amount).toLocaleString()+'원</td></tr>':'')+
                '<tr><td style="font-weight:600">결제 상태</td><td>'+(req.payment_status==='released'?'<span class="badge" style="background:#d1fae5;color:#065f46">정산 완료</span>':'<span class="badge" style="background:#fef3c7;color:#92400e">에스크로 보관 중</span>')+'</td></tr>' +
                (req.tracking_number?'<tr><td style="font-weight:600">송장번호</td><td><code>'+escHtml(req.tracking_number)+'</code></td></tr>':'')+
                (req.shipped_at?'<tr><td style="font-weight:600">배송 시작일</td><td>'+new Date(req.shipped_at).toLocaleString('ko-KR')+'</td></tr>':'')+
                (req.completed_at?'<tr><td style="font-weight:600">거래 완료일</td><td>'+new Date(req.completed_at).toLocaleString('ko-KR')+'</td></tr>':'')+
                '</table>';
        }

        // Phase 4: 의뢰자 액션 (수령 확인)
        var ownerAction = '';
        if (req.status === 'shipping') {
            ownerAction = '<button class="btn btn-success" onclick="confirmDeliveryAction(\''+req.id+'\')">📦 수령 확인 (정산 완료)</button>';
        }

        body.innerHTML =
            '<table class="data-table mb-16">' +
            '<tr><td style="width:120px;font-weight:600">의뢰 유형</td><td>'+(tMap[req.request_type]||req.request_type)+'</td></tr>' +
            '<tr><td style="font-weight:600">카테고리</td><td>'+escHtml(req.category)+'</td></tr>' +
            '<tr><td style="font-weight:600">수량</td><td>'+req.quantity.toLocaleString()+'개</td></tr>' +
            '<tr><td style="font-weight:600">희망 단가</td><td>'+req.target_price.toLocaleString()+'원</td></tr>' +
            '<tr><td style="font-weight:600">예상 총액</td><td class="text-primary fw-bold">'+(req.quantity*req.target_price).toLocaleString()+'원</td></tr>' +
            (req.bid_deadline?'<tr><td style="font-weight:600">입찰 마감일</td><td>'+req.bid_deadline+'</td></tr>':'')+
            '<tr><td style="font-weight:600">상태</td><td>'+(sMap[req.status]||req.status)+'</td></tr>' +
            '<tr><td style="font-weight:600">등록일</td><td>'+new Date(req.created_at).toLocaleString('ko-KR')+'</td></tr>' +
            (req.design_guide?'<tr><td style="font-weight:600">디자인 가이드</td><td style="white-space:pre-wrap">'+escHtml(req.design_guide)+'</td></tr>':'')+
            (req.detail_note?'<tr><td style="font-weight:600">상세 요청</td><td style="white-space:pre-wrap">'+escHtml(req.detail_note)+'</td></tr>':'')+
            '</table>'+bidsSection+filesSection+txnRows+
            '<div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px">' +
            (req.status==='bidding'?'<button class="btn btn-danger btn-sm" onclick="closeModal(\'requestDetailModal\');cancelRequest(\''+req.id+'\')">의뢰 취소</button>':'')+
            ownerAction +
            '<button class="btn btn-secondary" onclick="closeModal(\'requestDetailModal\')">닫기</button>' +
            '</div>';
    } catch(e) {
        console.error(e);
        if (body) body.innerHTML = '<div class="empty-state"><p>오류: '+escHtml(e.message)+'</p></div>';
    }
}

// ── 매칭 이력 ──────────────────────────────────────────
async function loadMatchHistoryBiz() {
    var tbody=document.getElementById('biz-match-tbody'); if(!tbody)return;
    try {
        var list=await Requests.getMatchHistory('business',20);
        if(!list.length){tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--gray)">매칭 이력이 없습니다.</td></tr>';return;}
        tbody.innerHTML=list.map(function(h){
            var sv=h.target_price>0?Math.round((1-h.matched_price/h.target_price)*100):0;
            return '<tr><td><strong>'+escHtml(h.title)+'</strong></td><td>'+(h.category||'-')+'</td><td>'+(h.quantity||0).toLocaleString()+'개</td><td>'+(h.target_price||0).toLocaleString()+'원</td><td class="text-success fw-bold">'+(h.matched_price||0).toLocaleString()+'원</td><td class="text-success">▼'+sv+'%</td><td>'+new Date(h.matched_at).toLocaleDateString('ko-KR')+'</td></tr>';
        }).join('');
    }catch(e){console.error(e);}
}

async function loadMatchHistoryPersonal() {
    var tbody=document.getElementById('personal-match-tbody'); if(!tbody)return;
    try {
        var list=await Requests.getMatchHistory(null,20);
        var f=list.filter(function(h){return h.request_type!=='business';});
        if(!f.length){tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray)">매칭 이력이 없습니다.</td></tr>';return;}
        var tMap={personal:'개인',group:'공동구매'};
        tbody.innerHTML=f.map(function(h){
            var cls=h.request_type==='group'?'status-recruiting':'status-completed';
            return '<tr><td><strong>'+escHtml(h.title)+'</strong></td><td>'+(h.quantity||0).toLocaleString()+'개</td><td>'+(h.target_price||0).toLocaleString()+'원</td><td class="text-success fw-bold">'+(h.matched_price||0).toLocaleString()+'원</td><td><span class="status-badge '+cls+'">'+(tMap[h.request_type]||h.request_type)+'</span></td><td>'+new Date(h.matched_at).toLocaleDateString('ko-KR')+'</td></tr>';
        }).join('');
    }catch(e){console.error(e);}
}

// ── 의뢰 생성 ──────────────────────────────────────────
async function submitBizRequest() {
    if (!AppState.currentUser) { openModal('loginModal'); return; }
    var btn = document.getElementById('biz-submit-btn');
    if (btn) { btn.disabled=true; btn.textContent='등록 중...'; }
    try {
        var category = document.getElementById('biz-category').value;
        var qty      = parseInt(document.getElementById('biz-qty').value);
        var price    = parseInt(document.getElementById('biz-price').value);
        var newReq   = await Requests.create({
            request_type: 'business',
            title:        document.getElementById('biz-title').value.trim(),
            category:     category, quantity: qty, target_price: price,
            bid_deadline: document.getElementById('biz-deadline').value||null,
            design_guide: document.getElementById('biz-design-guide').value,
            detail_note:  document.getElementById('biz-detail-note').value,
            status: 'bidding', bidding_type: 'bidding'
        });
        // 디자인 파일 업로드 (실패해도 의뢰는 등록됨)
        try { await uploadRequestFiles(newReq.id, document.getElementById('biz-file-input')); }
        catch(fe){ console.warn('파일 업로드 오류:', fe.message); }
        // 더미 입찰 생성 (실패해도 의뢰는 등록됨)
        try {
            await DummyBids.generateBids(newReq.id, category, price, qty);
            showToast('의뢰 등록 완료! 입찰이 도착했습니다 🎉', 'success');
        } catch(bidErr) {
            console.error('입찰 생성 오류:', bidErr);
            showToast('의뢰가 등록되었습니다. (입찰 생성 오류)', 'info');
        }
        resetBizForm();
        // 즉시 목록 갱신
        showBizTab('manage', null);
        loadBizDashboard();
    } catch(e) {
        showToast('오류: '+e.message, 'error');
    } finally {
        if (btn) { btn.disabled=false; btn.textContent='🚀 의뢰 등록'; }
    }
}

async function submitPersonalRequest() {
    if (!AppState.currentUser) { openModal('loginModal'); return; }
    var qty   = parseInt(document.getElementById('personalQty').value)||0;
    var price = parseInt(document.getElementById('personalPrice').value)||0;
    var name  = document.getElementById('personalItemName').value.trim();
    if (!name||!qty||!price) { showToast('필수 항목을 모두 입력해주세요.','error'); return; }
    var reasons=[];
    if (qty>50)              reasons.push('📦 수량 '+qty+'개는 공동구매로 진행하면 더 유리합니다.');
    if (price>0&&price<1500) reasons.push('💰 희망 단가('+price.toLocaleString()+'원)가 낮습니다.');
    if (reasons.length>0) {
        document.getElementById('coPurchaseReason').innerHTML=reasons.map(function(r){return '<p class="text-sm" style="margin-bottom:8px">'+r+'</p>';}).join('');
        openModal('coPurchasePopup'); return;
    }
    await doSubmitPersonalRequest();
}

async function doSubmitPersonalRequest() {
    var typeEl = document.querySelector('input[name="request-type"]:checked');
    var bType  = typeEl ? typeEl.value : 'bidding';
    try {
        var category = document.getElementById('personalCategory').value;
        var qty      = parseInt(document.getElementById('personalQty').value);
        var price    = parseInt(document.getElementById('personalPrice').value);
        var newReq   = await Requests.create({
            request_type: 'personal',
            title:        document.getElementById('personalItemName').value.trim(),
            category:     category, quantity: qty, target_price: price,
            bid_deadline: document.getElementById('personalDeadline').value||null,
            design_guide: document.getElementById('personalDesignGuide').value,
            detail_note:  document.getElementById('personalDetailNote').value,
            bidding_type: bType,
            direct_manufacturer_id: bType==='direct'?document.getElementById('directMfgId').value:null,
            status: 'bidding'
        });
        // 디자인 파일 업로드
        try { await uploadRequestFiles(newReq.id, document.getElementById('personal-file-input')); }
        catch(fe){ console.warn('파일 업로드 오류:', fe.message); }
        if (bType==='bidding') {
            try { await DummyBids.generateBids(newReq.id, category, price, qty); } catch(e){ console.error(e); }
        }
        showToast('개인 의뢰가 등록되었습니다! 🎉','success');
        showPersonalTab('myorders', null);
        loadPersonalDashboard();
    } catch(e) { showToast('오류: '+e.message,'error'); }
}

async function submitGroupRequest() {
    if (!AppState.currentUser) { openModal('loginModal'); return; }
    var title    = document.getElementById('group-title').value.trim();
    var category = document.getElementById('group-category').value;
    var totalQty = parseInt(document.getElementById('group-total-qty').value)||0;
    var minQty   = parseInt(document.getElementById('group-min-qty').value)||0;
    var price    = parseInt(document.getElementById('group-price').value)||0;
    if (!title||!category||!totalQty||!minQty||!price) { showToast('필수 항목을 모두 입력해주세요.','error'); return; }
    try {
        var gTypeEl = document.querySelector('input[name="group-type"]:checked');
        await Requests.create({
            request_type:'group', title, category,
            quantity:totalQty, min_quantity:minQty, target_price:price,
            recruit_deadline: document.getElementById('group-recruit-deadline').value||null,
            bid_deadline:     document.getElementById('group-bid-deadline').value||null,
            design_guide:     document.getElementById('group-design-guide').value,
            detail_note:      document.getElementById('group-detail-note').value,
            current_quantity:0, status:'bidding',
            bidding_type: gTypeEl ? gTypeEl.value : 'bidding'
        });
        showToast('공동제작 의뢰가 등록되었습니다! 🎉','success');
        showPersonalTab('myorders', null);
        loadPersonalDashboard();
    } catch(e) { showToast('오류: '+e.message,'error'); }
}

// ── 매칭 확정 ──────────────────────────────────────────
function confirmSelectBid(requestId, bidId, manufacturerName, unitPrice) {
    AppState.pendingMatch = {requestId, bidId, name:manufacturerName, price:unitPrice};
    var amountEl = document.getElementById('matchPayAmount');
    var detailEl = document.getElementById('matchPayDetail');
    if (amountEl) amountEl.textContent = '계산 중...';
    if (detailEl) detailEl.textContent = '';
    Requests.getById(requestId).then(function(req){
        if (req && amountEl) {
            amountEl.textContent = (req.quantity*unitPrice).toLocaleString()+'원';
            if (detailEl) detailEl.textContent = req.title+' '+req.quantity.toLocaleString()+'개 × '+unitPrice.toLocaleString()+'원 ('+manufacturerName+')';
        }
    });
    openModal('matchConfirmModal');
}

async function executeSelectBid() {
    var pm  = AppState.pendingMatch;
    if (!pm.requestId||!pm.bidId) { showToast('오류: 매칭 정보가 없습니다.','error'); return; }
    var btn = document.getElementById('matchConfirmBtn');
    var pmEl = document.getElementById('matchPayMethod');
    var paymentMethod = pmEl ? pmEl.value : '신용카드';
    if (btn) { btn.disabled=true; btn.textContent='결제 처리 중...'; }
    try {
        await Requests.confirmMatch(pm.requestId, pm.bidId, pm.name, pm.price, paymentMethod);
        // 생산자에게 매칭 알림
        try {
            var bidOwnerRes = await window.supabaseClient.from('bids').select('manufacturer_id').eq('id',pm.bidId).single();
            if (!bidOwnerRes.error && bidOwnerRes.data) {
                await Notifications.create(bidOwnerRes.data.manufacturer_id, 'bid_selected', '🎉 입찰이 선정되었습니다!', '결제가 완료되었으니 제작을 시작해주세요. ('+paymentMethod+')', pm.requestId);
            }
        } catch(ne){ console.warn('알림 생성 실패:', ne.message); }
        closeModal('matchConfirmModal');
        AppState.pendingMatch = {};
        showToast('💳 결제가 완료되었습니다 (가상 에스크로) 🎉','success');
        // 즉시 목록 & 대시보드 갱신
        await loadMyRequests('business');
        await loadMyRequests('personal');
        loadBizDashboard();
        loadPersonalDashboard();
        loadMatchHistoryBiz();
        loadMatchHistoryPersonal();
    } catch(e) {
        showToast('오류: '+e.message,'error');
    } finally {
        if (btn) { btn.disabled=false; btn.textContent='💳 결제 및 매칭 확정'; }
    }
}

async function cancelRequest(requestId) {
    if (!confirm('정말로 이 의뢰를 취소하시겠습니까?')) return;
    try {
        await Requests.cancel(requestId);
        showToast('의뢰가 취소되었습니다.','info');
        await loadMyRequests('business');
        await loadMyRequests('personal');
        loadBizDashboard();
        loadPersonalDashboard();
    } catch(e) { showToast('오류: '+e.message,'error'); }
}

function filterBizStatus(status, btn) {
    if (btn) {
        document.querySelectorAll('#biz-status-pills .pill-filter').forEach(function(p){p.classList.remove('active');});
        btn.classList.add('active');
    }
    document.querySelectorAll('#biz-manage-list .request-card').forEach(function(c){
        var show = status==='all' ? true
            : status==='completed' ? (c.dataset.status==='matched'||c.dataset.status==='producing'||c.dataset.status==='shipping'||c.dataset.status==='completed')
            : c.dataset.status===status;
        c.style.display = show ? 'block' : 'none';
    });
}

// ── 개인 의뢰 관리 유형 탭 전환 ───────────────────────
function switchOrderType(type, btn) {
    document.querySelectorAll('.order-type-tab').forEach(function(b){ b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    var ind = document.getElementById('individual-orders-section');
    var grp = document.getElementById('group-orders-section');
    if (type === 'individual') {
        if (ind) ind.style.display = 'block';
        if (grp) grp.style.display = 'none';
    } else {
        if (ind) ind.style.display = 'none';
        if (grp) grp.style.display = 'block';
    }
}

function filterIndividualStatus(status, btn) {
    if (btn) {
        document.querySelectorAll('#individual-status-pills .pill-filter').forEach(function(p){p.classList.remove('active');});
        btn.classList.add('active');
    }
    document.querySelectorAll('#personal-individual-list .request-card').forEach(function(c){
        var show = status==='all' ? true
            : status==='completed' ? (['matched','producing','shipping','completed'].indexOf(c.dataset.status) >= 0)
            : c.dataset.status===status;
        c.style.display = show ? 'block' : 'none';
    });
}

function filterGroupStatus(status, btn) {
    if (btn) {
        document.querySelectorAll('#group-status-pills .pill-filter').forEach(function(p){p.classList.remove('active');});
        btn.classList.add('active');
    }
    document.querySelectorAll('#personal-group-list .request-card').forEach(function(c){
        var show = status==='all' ? true
            : status==='completed' ? (['matched','producing','shipping','completed'].indexOf(c.dataset.status) >= 0)
            : c.dataset.status===status;
        c.style.display = show ? 'block' : 'none';
    });
}

// ── 의뢰 목록 분할 로드 (일반 / 공동구매) ─────────────
async function loadMyRequestsSplit() {
    var indList = document.getElementById('personal-individual-list');
    var grpList = document.getElementById('personal-group-list');
    if (!indList || !grpList) return;

    if (!AppState.currentUser) {
        var msg = '<div class="empty-state"><div class="empty-icon">🔐</div><p>로그인 후 확인할 수 있습니다.</p><button class="btn btn-primary" onclick="openModal(\'loginModal\')">로그인</button></div>';
        indList.innerHTML = msg; grpList.innerHTML = msg; return;
    }
    indList.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>로딩 중...</p></div>';
    grpList.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>로딩 중...</p></div>';
    try {
        var all = await Requests.getMyRequests();
        var individual = all.filter(function(r){ return r.request_type === 'personal'; });
        var group      = all.filter(function(r){ return r.request_type === 'group'; });

        if (!individual.length) {
            indList.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>등록된 개인 의뢰가 없습니다.</p><button class="btn btn-primary" onclick="showPersonalTab(\'individual\',null)">의뢰 만들기</button></div>';
        } else {
            indList.innerHTML = individual.map(renderRequestCard).join('');
        }
        if (!group.length) {
            grpList.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>등록된 공동구매 의뢰가 없습니다.</p><button class="btn btn-primary" onclick="showPersonalTab(\'group\',null)">공동구매 만들기</button></div>';
        } else {
            grpList.innerHTML = group.map(renderRequestCard).join('');
        }
    } catch(e) {
        console.error(e);
        indList.innerHTML = '<div class="empty-state"><p>오류가 발생했습니다.</p></div>';
        grpList.innerHTML = '<div class="empty-state"><p>오류가 발생했습니다.</p></div>';
    }
}

// ── 프로필 드롭다운 메뉴 (역할별) ──────────────────────
function renderProfileMenu() {
    var menuEl = document.getElementById('profileMenuItems');
    if (!menuEl) return;
    var p    = AppState.currentProfile;
    var type = p ? p.user_type : '';

    var badge = document.getElementById('profileUserTypeBadge');
    if (badge) {
        var typeLabels = { personal:'개인 의뢰자', business:'사업자 의뢰자', manufacturer:'생산자' };
        badge.textContent = typeLabels[type] || type;
        badge.style.display = type ? 'inline-block' : 'none';
    }

    var items = [];
    if (type === 'manufacturer') {
        var mType = AppState.mfgType || 'factory';
        items = [
            { label:'📊 내 입찰 현황',   action:"navigateTo('manufacturer-"+mType+"');showMfgTab('bids',null);closeDropdown()" },
            { label:'👤 내 프로필',       action:"navigateTo('manufacturer-"+mType+"');showMfgTab('profile',null);closeDropdown()" },
            { label:'🔍 추천 의뢰 목록', action:"navigateTo('manufacturer-"+mType+"');showMfgTab('requests',null);closeDropdown()" },
            { label:'💳 결제/정산',       action:"navigateTo('manufacturer-"+mType+"');showMfgTab('payments',null);closeDropdown()" },
            { label:'⚙️ 계정 설정',       action:"closeDropdown();showToast('구현 예정','info')" }
        ];
    } else if (type === 'business') {
        items = [
            { label:'📁 내 의뢰 관리', action:"navigateTo('client-business');showBizTab('manage',null);closeDropdown()" },
            { label:'📊 대시보드',     action:"navigateTo('client-business');closeDropdown()" },
            { label:'💳 결제/정산',    action:"navigateTo('client-business');showBizTab('payments',null);closeDropdown()" },
            { label:'⚙️ 계정 설정',    action:"closeDropdown();showToast('구현 예정','info')" }
        ];
    } else {
        items = [
            { label:'📁 내 의뢰 관리',  action:"navigateTo('client-personal');showPersonalTab('myorders',null);closeDropdown()" },
            { label:'👥 공동구매 내역', action:"navigateTo('client-personal');showPersonalTab('myorders',null);switchOrderType('group',null);closeDropdown()" },
            { label:'🛒 마켓플레이스',  action:"navigateTo('marketplace');closeDropdown()" },
            { label:'⚙️ 계정 설정',     action:"closeDropdown();showToast('구현 예정','info')" }
        ];
    }

    menuEl.innerHTML = items.map(function(item){
        return '<li><button onclick="' + item.action + '">' + item.label + '</button></li>';
    }).join('') +
    '<li style="border-top:1px solid #E2E8F0;margin-top:4px;padding-top:4px"><button style="color:var(--danger)" onclick="handleLogout()">로그아웃</button></li>';
}

// ── 생산자 탭 전환 ─────────────────────────────────────
function showMfgTab(tab, btn) {
    document.querySelectorAll('#page-manufacturer .main-content > .tab-content')
        .forEach(function(el){ el.classList.remove('active'); });
    var el = document.getElementById('mfg-'+tab);
    if (el) el.classList.add('active');
    document.querySelectorAll('#page-manufacturer .sidebar-menu button')
        .forEach(function(b){ b.classList.remove('active'); });
    if (btn) { btn.classList.add('active'); }
    else {
        var m = {dashboard:0, requests:1, bids:2, profile:3, payments:4};
        var bs = document.querySelectorAll('#page-manufacturer .sidebar-menu button');
        if (m[tab] !== undefined && bs[m[tab]]) bs[m[tab]].classList.add('active');
    }
    if (tab === 'dashboard') loadMfgDashboard();
    if (tab === 'bids')      loadMfgBids();
    if (tab === 'requests')  loadMfgAvailableRequests();
    if (tab === 'profile')   loadMfgProfile();
    if (tab === 'payments')  loadMfgPayments();
}

// ── 생산자 대시보드 ────────────────────────────────────
async function loadMfgDashboard() {
    if (!AppState.currentUser) return;
    try {
        var bids = await Requests.getMyBids();
        setEl('mfg-count-all',       bids.length);
        setEl('mfg-dash-bidding',    bids.filter(function(b){ return b.status==='pending'||b.status==='submitted'; }).length);
        setEl('mfg-dash-producing',  bids.filter(function(b){ return b.requests&&b.requests.status==='producing'; }).length);
        setEl('mfg-dash-completed',  bids.filter(function(b){ return b.status==='selected'&&b.requests&&b.requests.status==='completed'; }).length);
    } catch(e) { console.error(e); }
    Requests.autoCompleteOverdueShipping().catch(function(e){ console.warn('auto-complete 실패:', e.message); });
}

// ── 생산자 입찰 현황 5단계 로드 ───────────────────────
async function loadMfgBids() {
    if (!AppState.currentUser) return;
    var sections = {
        bidding:   document.getElementById('mfg-bid-list-bidding'),
        matched:   document.getElementById('mfg-bid-list-matched'),
        producing: document.getElementById('mfg-bid-list-producing'),
        shipping:  document.getElementById('mfg-bid-list-shipping'),
        completed: document.getElementById('mfg-bid-list-completed')
    };
    Object.values(sections).forEach(function(el){
        if (el) el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--gray)">로딩 중...</div>';
    });
    try {
        var bids = await Requests.getMyBids();
        var cat = { bidding:[], matched:[], producing:[], shipping:[], completed:[] };
        bids.forEach(function(bid) {
            var rs = bid.requests ? bid.requests.status : null;
            if      (bid.status==='selected' && rs==='completed') cat.completed.push(bid);
            else if (bid.status==='selected' && rs==='shipping')  cat.shipping.push(bid);
            else if (bid.status==='selected' && rs==='producing') cat.producing.push(bid);
            else if (bid.status==='selected')                     cat.matched.push(bid);
            else                                                  cat.bidding.push(bid);
        });
        var emptyLabels = {
            bidding:'진행 중인 입찰이 없습니다.', matched:'매칭 완료된 건이 없습니다.',
            producing:'생산 진행 중인 건이 없습니다.', shipping:'배송 중인 건이 없습니다.', completed:'완료된 건이 없습니다.'
        };
        Object.keys(cat).forEach(function(key) {
            setEl('mfg-bcount-'+key, cat[key].length);
            var el = sections[key]; if (!el) return;
            el.innerHTML = cat[key].length
                ? cat[key].map(renderMfgBidCard).join('')
                : '<div class="empty-state" style="padding:20px"><p class="text-sm">'+emptyLabels[key]+'</p></div>';
        });
    } catch(e) {
        console.error(e);
        Object.values(sections).forEach(function(el){ if(el) el.innerHTML='<div style="padding:16px;text-align:center;color:var(--danger)">오류가 발생했습니다.</div>'; });
    }
}

function renderMfgBidCard(bid) {
    var req   = bid.requests || {};
    var title = escHtml(req.title || '(의뢰 정보 없음)');
    var qty   = (req.quantity || 0).toLocaleString();
    var date  = bid.created_at ? new Date(bid.created_at).toLocaleDateString('ko-KR') : '-';
    var price = (bid.unit_price || 0).toLocaleString();
    var rs    = req.status || '';

    var actionBtn = '';
    if (bid.status === 'selected') {
        if (rs === 'matched') {
            actionBtn = '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();startProductionAction(\''+req.id+'\')">🏭 제작 시작</button>';
        } else if (rs === 'producing') {
            actionBtn = '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openShipModal(\''+req.id+'\')">🚚 배송 시작</button>';
        } else if (rs === 'shipping') {
            actionBtn = '<span class="badge" style="background:#fef3c7;color:#92400e">의뢰자 수령 확인 대기</span>';
        } else if (rs === 'completed') {
            actionBtn = '<span class="badge" style="background:#d1fae5;color:#065f46">정산 완료</span>';
        }
    }

    return '<div class="mfg-bid-card" onclick="openMfgBidDetail(\''+bid.id+'\')">' +
        '<div class="flex-between">' +
        '<div><strong>'+title+'</strong><p class="text-xs text-muted" style="margin-top:4px">'+escHtml(req.category||'')+(req.category?' | ':'')+'수량 '+qty+'개</p></div>' +
        '<div style="text-align:right"><div style="font-weight:700;color:var(--primary)">'+price+'원<span class="text-xs text-muted">/개</span></div><div class="text-xs text-muted">'+date+'</div></div>' +
        '</div>' +
        (actionBtn ? '<div style="display:flex;justify-content:flex-end;margin-top:10px">'+actionBtn+'</div>' : '') +
        '</div>';
}

// ── 생산자 입찰 상세 팝업 ──────────────────────────────
async function openMfgBidDetail(bidId) {
    openModal('mfgBidDetailModal');
    var body    = document.getElementById('mfg-bid-detail-body');
    var titleEl = document.getElementById('mfg-bid-detail-title');
    if (body) body.innerHTML = '<div style="text-align:center;padding:40px"><div style="font-size:32px">⏳</div><p>로딩 중...</p></div>';
    try {
        var bids = await Requests.getMyBids();
        var bid  = bids.find(function(b){ return b.id===bidId; });
        if (!bid) throw new Error('입찰 정보를 찾을 수 없습니다.');
        var req  = bid.requests || {};
        if (titleEl) titleEl.textContent = '📄 '+(req.title||'입찰 상세');
        var tMap = {business:'사업자 의뢰',personal:'개인 의뢰',group:'공동구매 의뢰'};
        var total = (bid.unit_price||0) * (req.quantity||0);
        body.innerHTML =
            '<h5 style="margin-bottom:12px;font-size:13px;color:var(--gray);text-transform:uppercase;letter-spacing:0.5px">의뢰 정보</h5>' +
            '<table class="data-table mb-16">' +
            '<tr><td style="width:120px;font-weight:600">의뢰 유형</td><td>'+(tMap[req.request_type]||req.request_type||'-')+'</td></tr>' +
            '<tr><td style="font-weight:600">카테고리</td><td>'+escHtml(req.category||'-')+'</td></tr>' +
            '<tr><td style="font-weight:600">수량</td><td>'+(req.quantity||0).toLocaleString()+'개</td></tr>' +
            '<tr><td style="font-weight:600">희망 단가</td><td>'+(req.target_price||0).toLocaleString()+'원</td></tr>' +
            (req.bid_deadline?'<tr><td style="font-weight:600">입찰 마감일</td><td>'+req.bid_deadline+'</td></tr>':'')+
            (req.design_guide?'<tr><td style="font-weight:600">디자인 가이드</td><td style="white-space:pre-wrap">'+escHtml(req.design_guide)+'</td></tr>':'')+
            (req.detail_note?'<tr><td style="font-weight:600">상세 요청</td><td style="white-space:pre-wrap">'+escHtml(req.detail_note)+'</td></tr>':'')+
            '</table>' +
            '<div class="divider"></div>' +
            '<h5 style="margin-bottom:12px;font-size:13px;color:var(--gray);text-transform:uppercase;letter-spacing:0.5px">내 견적</h5>' +
            '<table class="estimate-table">' +
            '<thead><tr><th>항목</th><th>수량</th><th>단가</th><th>금액</th></tr></thead>' +
            '<tbody><tr><td>'+escHtml(req.title||'-')+' 제작비</td><td>'+(req.quantity||0).toLocaleString()+'개</td><td>'+(bid.unit_price||0).toLocaleString()+'원</td><td>'+total.toLocaleString()+'원</td></tr></tbody>' +
            '<tfoot><tr style="font-weight:700"><td colspan="3" style="text-align:right">합계</td><td class="text-primary">'+total.toLocaleString()+'원</td></tr></tfoot>' +
            '</table>' +
            '<div style="background:var(--bg);border-radius:8px;padding:12px 16px;margin-top:12px;display:flex;gap:24px;flex-wrap:wrap">' +
            '<div><div class="text-xs text-muted">예상 납기</div><div style="font-weight:700;font-size:16px;color:var(--primary)">'+(bid.delivery_days||'-')+'일</div></div>' +
            '<div><div class="text-xs text-muted">총 견적 금액</div><div style="font-weight:700;font-size:16px">'+total.toLocaleString()+'원</div></div>' +
            '</div>' +
            (bid.note?'<div class="alert alert-info mt-16"><span>📝</span><span><strong>메모:</strong> '+escHtml(bid.note)+'</span></div>':'')+
            renderMfgTransactionSection(bid, req) +
            '<div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px">' +
            renderMfgActionButtons(bid, req) +
            '<button class="btn btn-secondary" onclick="closeModal(\'mfgBidDetailModal\')">닫기</button></div>';
    } catch(e) {
        console.error(e);
        if (body) body.innerHTML = '<div class="empty-state"><p>오류: '+escHtml(e.message)+'</p></div>';
    }
}

// ── 생산자 추천 의뢰 목록 ─────────────────────────────
async function loadMfgAvailableRequests() {
    var container = document.getElementById('mfg-requests-list');
    if (!container) return;
    if (!AppState.currentUser) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔐</div><p>로그인 후 확인할 수 있습니다.</p><button class="btn btn-primary" onclick="openModal(\'loginModal\')">로그인</button></div>';
        return;
    }
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>로딩 중...</p></div>';
    try {
        var catFilter = document.getElementById('mfg-category-filter');
        var category  = catFilter ? catFilter.value : '';
        var q = window.supabaseClient.from('requests').select('*, bids(id)').eq('status','bidding').order('created_at',{ascending:false}).limit(20);
        if (category) q = q.eq('category', category);
        var res = await q;
        if (res.error) throw res.error;
        var list = res.data || [];
        if (!list.length) { container.innerHTML='<div class="empty-state"><div class="empty-icon">📋</div><p>현재 입찰 가능한 의뢰가 없습니다.</p></div>'; return; }
        container.innerHTML = list.map(function(req) {
            var bidCount = req.bids ? req.bids.length : 0;
            var diff = req.bid_deadline ? Math.ceil((new Date(req.bid_deadline)-new Date())/86400000) : null;
            var ddText = diff !== null ? (diff>=0?'D-'+diff:'마감') : '';
            return '<div class="request-card" style="cursor:pointer" onclick="openRequestDetail(\''+req.id+'\')">' +
                '<div class="request-card-header"><h4>'+escHtml(req.title)+'</h4><span class="status-badge status-bidding">'+bidCount+'명 입찰중</span></div>' +
                '<div class="request-meta">' +
                '<div class="meta-item">📦 '+escHtml(req.category||'-')+'</div>' +
                '<div class="meta-item">🔢 수량: <strong>'+(req.quantity||0).toLocaleString()+'개</strong></div>' +
                '<div class="meta-item">💰 희망 단가: <strong>'+(req.target_price||0).toLocaleString()+'원</strong></div>' +
                (ddText?'<div class="meta-item">📅 마감: <strong>'+ddText+'</strong></div>':'')+
                '</div>' +
                '<div class="request-actions"><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openSubmitBidModal(\''+req.id+'\')">📨 입찰하기</button></div>' +
                '</div>';
        }).join('');
    } catch(e) { console.error(e); container.innerHTML='<div class="empty-state"><p>오류가 발생했습니다.</p></div>'; }
}

async function saveMfgProfile() {
    if (!AppState.currentUser) { openModal('loginModal'); return; }
    var nickname  = document.getElementById('mfg-profile-nickname')  ? document.getElementById('mfg-profile-nickname').value.trim() : '';
    var specialty = document.getElementById('mfg-profile-specialty') ? document.getElementById('mfg-profile-specialty').value : '';
    var maxQty    = document.getElementById('mfg-profile-max-qty')   ? parseInt(document.getElementById('mfg-profile-max-qty').value)||null : null;
    var minQty    = document.getElementById('mfg-profile-min-qty')   ? parseInt(document.getElementById('mfg-profile-min-qty').value)||null : null;
    var intro     = document.getElementById('mfg-profile-intro')     ? document.getElementById('mfg-profile-intro').value.trim() : '';
    if (!nickname) { showToast('닉네임을 입력해주세요.','error'); return; }
    var btn = document.querySelector('#mfg-profile .btn-primary');
    if (btn) { btn.disabled=true; btn.textContent='저장 중...'; }
    try {
        await Bids.saveProfile({ nickname, specialty, maxQuantity:maxQty, minQuantity:minQty, intro });
        AppState.currentProfile = Object.assign({}, AppState.currentProfile, {
            nickname, specialty, max_quantity:maxQty, min_quantity:minQty, manufacturer_intro:intro
        });
        setEl('mfg-sidebar-name', nickname);
        setEl('profileName', nickname);
        var avatar = document.getElementById('userAvatar');
        if (avatar) avatar.textContent = nickname[0].toUpperCase();
        showToast('프로필이 저장되었습니다! 💾','success');
    } catch(e) {
        showToast('저장 실패: '+e.message,'error');
    } finally {
        if (btn) { btn.disabled=false; btn.textContent='💾 저장'; }
    }
}

function loadMfgProfile() {
    var p = AppState.currentProfile;
    if (!p) return;
    var nick = document.getElementById('mfg-profile-nickname');
    var spec = document.getElementById('mfg-profile-specialty');
    var maxQ = document.getElementById('mfg-profile-max-qty');
    var minQ = document.getElementById('mfg-profile-min-qty');
    var intr = document.getElementById('mfg-profile-intro');
    if (nick) nick.value = p.nickname || '';
    if (spec) spec.value = p.specialty || '';
    if (maxQ) maxQ.value = p.max_quantity || '';
    if (minQ) minQ.value = p.min_quantity || '';
    if (intr) intr.value = p.manufacturer_intro || '';
}

async function openSubmitBidModal(requestId) {
    if (!AppState.currentUser) { openModal('loginModal'); return; }
    var alreadyBid = await Bids.hasAlreadyBid(requestId);
    if (alreadyBid) { showToast('이미 이 의뢰에 입찰하셨습니다.','warning'); return; }

    _pendingBidRequestId = requestId;
    _pendingBidQuantity  = 0;

    ['bid-unit-price','bid-delivery-days','bid-note'].forEach(function(id){
        var el=document.getElementById(id); if(el) el.value='';
    });
    var fileEl = document.getElementById('bid-quote-file');
    if (fileEl) fileEl.value = '';
    var fileNameEl = document.getElementById('bid-file-name');
    if (fileNameEl) fileNameEl.innerHTML = '';
    var totalEl = document.getElementById('bid-total-display');
    if (totalEl) totalEl.style.display = 'none';

    openModal('submitBidModal');

    var summaryEl = document.getElementById('submit-bid-req-summary');
    if (summaryEl) summaryEl.innerHTML = '<div style="text-align:center;padding:8px;color:var(--gray)">⏳ 로딩 중...</div>';
    try {
        var res = await window.supabaseClient.from('requests')
            .select('title,category,quantity,target_price,bid_deadline')
            .eq('id', requestId).single();
        if (res.error) throw res.error;
        var req = res.data;
        _pendingBidQuantity = req.quantity || 0;
        if (summaryEl) {
            summaryEl.innerHTML =
                '<div class="flex-between"><strong>'+escHtml(req.title)+'</strong><span class="status-badge status-bidding">입찰중</span></div>' +
                '<div class="request-meta" style="margin-top:8px">' +
                '<div class="meta-item">📦 '+escHtml(req.category||'-')+'</div>' +
                '<div class="meta-item">🔢 수량: <strong>'+_pendingBidQuantity.toLocaleString()+'개</strong></div>' +
                '<div class="meta-item">💰 희망 단가: <strong>'+(req.target_price||0).toLocaleString()+'원</strong></div>' +
                (req.bid_deadline?'<div class="meta-item">📅 마감: <strong>'+req.bid_deadline+'</strong></div>':'')+
                '</div>';
        }
    } catch(e) {
        if (summaryEl) summaryEl.innerHTML = '<p class="text-sm text-muted">의뢰 정보를 불러올 수 없습니다.</p>';
    }
}

function calcBidTotal() {
    var priceEl      = document.getElementById('bid-unit-price');
    var totalDisplay = document.getElementById('bid-total-display');
    var totalAmount  = document.getElementById('bid-total-amount');
    if (!priceEl || !totalDisplay || !totalAmount) return;
    var price = parseInt(priceEl.value) || 0;
    if (price > 0 && _pendingBidQuantity > 0) {
        totalDisplay.style.display = 'block';
        totalAmount.textContent = (price * _pendingBidQuantity).toLocaleString() + '원';
    } else {
        totalDisplay.style.display = 'none';
    }
}

function showBidFileName(input) {
    var el = document.getElementById('bid-file-name');
    if (!el || !input.files.length) return;
    var f = input.files[0];
    el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg);border-radius:6px;font-size:13px">' +
        '<span>📎 '+escHtml(f.name)+' ('+(f.size/1024).toFixed(0)+'KB)</span>' +
        '<button onclick="document.getElementById(\'bid-quote-file\').value=\'\';this.parentElement.parentElement.innerHTML=\'\'" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px">×</button></div>';
}

async function submitBid() {
    if (!_pendingBidRequestId) { showToast('오류: 의뢰 정보가 없습니다.','error'); return; }
    var unitPrice    = parseInt(document.getElementById('bid-unit-price').value) || 0;
    var deliveryDays = parseInt(document.getElementById('bid-delivery-days').value) || 0;
    var noteEl       = document.getElementById('bid-note');
    var note         = noteEl ? noteEl.value.trim() : '';
    if (!unitPrice)    { showToast('제안 단가를 입력해주세요.','error'); return; }
    if (!deliveryDays) { showToast('납기 일수를 입력해주세요.','error'); return; }
    var btn = document.getElementById('submitBidBtn');
    if (btn) { btn.disabled=true; btn.textContent='제출 중...'; }
    try {
        var bid = await Bids.submit({
            requestId:    _pendingBidRequestId,
            unitPrice:    unitPrice,
            deliveryDays: deliveryDays,
            note:         note
        });
        var fileInput = document.getElementById('bid-quote-file');
        if (fileInput && fileInput.files.length > 0) {
            try { await Bids.uploadQuoteFile(bid.id, fileInput.files[0]); }
            catch(fe) { console.warn('견적서 업로드 실패:', fe.message); }
        }
        // 의뢰자에게 입찰 알림
        try {
            var reqOwnerRes = await window.supabaseClient.from('requests').select('user_id,title').eq('id',_pendingBidRequestId).single();
            if (!reqOwnerRes.error && reqOwnerRes.data) {
                await Notifications.create(reqOwnerRes.data.user_id, 'new_bid', '새 입찰이 도착했습니다 📨', reqOwnerRes.data.title+' 의뢰에 새 입찰이 등록되었습니다.', _pendingBidRequestId);
            }
        } catch(ne){ console.warn('알림 생성 실패:', ne.message); }
        closeModal('submitBidModal');
        showToast('입찰이 완료되었습니다! 🎉','success');
        loadMfgBids();
        loadMfgDashboard();
    } catch(e) {
        showToast('입찰 실패: '+e.message,'error');
    } finally {
        if (btn) { btn.disabled=false; btn.textContent='📨 입찰 제출'; }
    }
}

// [DEPRECATED Phase 4] 권한 검증 우회 통로. startProductionAction / openShipModal / confirmDeliveryAction 사용.
async function updateBidStatus(requestId, newStatus, btn) {
    showToast('이 기능은 새 흐름으로 대체되었습니다.','warning');
    if (btn) { btn.disabled=false; }
}

// ── 파일 업로드 (의뢰 디자인 파일) ────────────────────
async function uploadRequestFiles(requestId, fileInput) {
    if (!fileInput || !fileInput.files || !fileInput.files.length) return;
    var files = Array.from(fileInput.files);
    for (var i = 0; i < files.length; i++) {
        var f = files[i];
        try {
            var safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            var path = requestId + '/' + Date.now() + '_' + i + '_' + safeName;
            var upRes = await window.supabaseClient.storage
                .from('request-files').upload(path, f, { upsert: false });
            if (upRes.error) { console.warn('업로드 실패:', f.name, upRes.error.message); continue; }
            var urlData = window.supabaseClient.storage.from('request-files').getPublicUrl(upRes.data.path);
            await window.supabaseClient.from('request_files').insert([{
                request_id: requestId,
                file_name:  f.name,
                file_url:   urlData.data.publicUrl,
                file_size:  f.size
            }]);
        } catch(fe){ console.warn('파일 처리 오류:', f.name, fe.message); }
    }
}

// ── 알림 ─────────────────────────────────────────────
async function updateNotificationBadge() {
    if (!AppState.currentUser) return;
    try {
        var count = await Notifications.getUnreadCount();
        var badge = document.getElementById('notif-badge');
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : String(count);
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    } catch(e){ console.warn('배지 업데이트 실패:', e.message); }
}

async function openNotificationModal() {
    openModal('notificationModal');
    var listEl = document.getElementById('notif-list');
    if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:32px;color:var(--gray)">⏳ 로딩 중...</div>';
    try {
        var notifs = await Notifications.getMyNotifications();
        renderNotificationList(notifs);
        await Notifications.markAllRead();
        updateNotificationBadge();
    } catch(e) {
        if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--gray)">알림을 불러올 수 없습니다.</div>';
    }
}

async function markAllNotificationsRead() {
    try {
        await Notifications.markAllRead();
        updateNotificationBadge();
        var listEl = document.getElementById('notif-list');
        if (listEl) listEl.querySelectorAll('[data-unread]').forEach(function(el){ el.removeAttribute('data-unread'); el.style.background=''; });
        showToast('모두 읽음 처리했습니다.','info');
    } catch(e){ showToast('오류: '+e.message,'error'); }
}

function renderNotificationList(notifs) {
    var listEl = document.getElementById('notif-list');
    if (!listEl) return;
    if (!notifs || !notifs.length) {
        listEl.innerHTML = '<div style="text-align:center;padding:32px;color:var(--gray)"><div style="font-size:36px;margin-bottom:12px">🔔</div><p>새로운 알림이 없습니다.</p></div>';
        return;
    }
    var icons = { new_bid:'📨', bid_selected:'✅', status_changed:'🔧', auto_matched:'⚡' };
    listEl.innerHTML = notifs.map(function(n) {
        var date = new Date(n.created_at).toLocaleDateString('ko-KR');
        var time = new Date(n.created_at).toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'});
        var icon = icons[n.type] || '🔔';
        var bg   = !n.is_read ? 'background:rgba(108,92,231,0.04);' : '';
        return '<div style="padding:14px 0;border-bottom:1px solid #E2E8F0;'+bg+'">' +
            '<div style="display:flex;gap:12px;align-items:flex-start">' +
            '<div style="font-size:22px;flex-shrink:0;margin-top:1px">'+icon+'</div>' +
            '<div style="flex:1;min-width:0">' +
            '<div class="flex-between">' +
            '<strong style="font-size:13px;line-height:1.4">'+escHtml(n.title)+'</strong>' +
            (!n.is_read?'<span style="width:8px;height:8px;background:var(--primary);border-radius:50%;display:inline-block;flex-shrink:0;margin-left:6px"></span>':'')+
            '</div>' +
            (n.message?'<p class="text-xs text-muted" style="margin-top:3px;line-height:1.5">'+escHtml(n.message)+'</p>':'')+
            '<span class="text-xs text-muted" style="margin-top:4px;display:block">'+date+' '+time+'</span>' +
            '</div></div></div>';
    }).join('');
}

// ── 자동 매칭 (마감 의뢰) ─────────────────────────────
async function autoMatchOverdueBids() {
    if (!AppState.currentUser) return;
    try {
        var today = new Date().toISOString().split('T')[0];
        var res = await window.supabaseClient
            .from('requests')
            .select('id, title, bids(*)')
            .eq('user_id', AppState.currentUser.id)
            .eq('status', 'bidding')
            .not('bid_deadline', 'is', null)
            .lt('bid_deadline', today);
        if (res.error || !res.data || !res.data.length) return;
        var overdue = res.data.filter(function(r){ return r.bids && r.bids.length > 0; });
        if (!overdue.length) return;
        for (var i = 0; i < overdue.length; i++) {
            var req = overdue[i];
            var sorted = req.bids.slice().sort(function(a,b){ return a.unit_price - b.unit_price; });
            var lowest = sorted[0];
            try {
                await Requests.selectBid(req.id, lowest.id, lowest.manufacturer_name || '생산자', lowest.unit_price);
                try {
                    await Notifications.create(lowest.manufacturer_id, 'auto_matched', '⚡ 자동 매칭되었습니다!', escHtml(req.title)+' 의뢰에 자동 매칭되었습니다. 생산을 시작해주세요!', req.id);
                } catch(ne){}
                showToast('"'+req.title+'" 마감 의뢰 자동 매칭 완료 ⚡', 'success');
            } catch(me){ console.warn('자동 매칭 실패:', req.id, me.message); }
        }
        // 목록 갱신
        loadMyRequests('business');
        loadMyRequestsSplit();
    } catch(e){ console.warn('자동 매칭 체크 오류:', e.message); }
}

// ── 마켓플레이스 ───────────────────────────────────────
function showMpTab(tab, btn) {
    document.querySelectorAll('#page-marketplace .tab-content').forEach(function(el){ el.classList.remove('active'); });
    var el = document.getElementById('mp-'+tab);
    if (el) el.classList.add('active');
    document.querySelectorAll('#marketplaceTabs .mp-tab').forEach(function(b){ b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    if (tab==='mass')    loadMpMassRequests('');
    if (tab==='group')   loadMpGroupRequests();
    if (tab==='reviews') loadMpReviews();
    if (tab==='promo')   loadMpPromo();
}

async function loadMarketplace() { loadMpMassRequests(''); }

async function loadMpMassRequests(category) {
    var container = document.getElementById('mp-mass-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>로딩 중...</p></div>';
    try {
        var q = window.supabaseClient.from('requests').select('*, bids(id)').eq('request_type','business').eq('status','bidding').order('created_at',{ascending:false}).limit(20);
        if (category) q = q.eq('category', category);
        var res = await q; if (res.error) throw res.error;
        var list = res.data || [];
        if (!list.length) { container.innerHTML='<div class="empty-state"><div class="empty-icon">📦</div><p>등록된 의뢰가 없습니다.</p></div>'; return; }
        container.innerHTML = list.map(function(req) {
            var bidCount = req.bids ? req.bids.length : 0;
            return '<div class="request-card">' +
                '<div class="request-card-header"><h4>'+escHtml(req.title)+'</h4><span class="status-badge status-bidding">'+bidCount+'명 입찰중</span></div>' +
                '<div class="request-meta">' +
                '<div class="meta-item">📦 '+escHtml(req.category||'-')+'</div>' +
                '<div class="meta-item">🔢 수량: <strong>'+(req.quantity||0).toLocaleString()+'개</strong></div>' +
                '<div class="meta-item">💰 단가: <strong>'+(req.target_price||0).toLocaleString()+'원</strong></div>' +
                '</div>' +
                '<div class="request-actions"><button class="btn btn-secondary btn-sm" onclick="openRequestDetail(\''+req.id+'\')">📋 상세 보기</button></div>' +
                '</div>';
        }).join('');
    } catch(e) { console.error(e); container.innerHTML='<div class="empty-state"><p>오류가 발생했습니다.</p></div>'; }
}

async function loadMpGroupRequests() {
    var container = document.getElementById('mp-group-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>로딩 중...</p></div>';
    try {
        var res = await window.supabaseClient.from('requests').select('*').eq('request_type','group').in('status',['bidding','recruiting']).order('created_at',{ascending:false}).limit(20);
        if (res.error) throw res.error;
        var list = res.data || [];
        if (!list.length) { container.innerHTML='<div class="empty-state"><div class="empty-icon">👥</div><p>모집 중인 공동구매가 없습니다.</p></div>'; return; }
        container.innerHTML = list.map(function(req) {
            var pct = req.min_quantity ? Math.min(100,Math.round((req.current_quantity||0)/req.min_quantity*100)) : 0;
            return '<div class="request-card">' +
                '<div class="request-card-header"><h4>👥 '+escHtml(req.title)+'</h4><span class="status-badge status-recruiting">모집중</span></div>' +
                '<div class="request-meta">' +
                '<div class="meta-item">📦 '+escHtml(req.category||'-')+'</div>' +
                '<div class="meta-item">💰 희망 단가: <strong>'+(req.target_price||0).toLocaleString()+'원</strong></div>' +
                '</div>' +
                '<div class="co-purchase-info">' +
                '<div class="flex-between"><span>모집 현황</span><strong>'+(req.current_quantity||0)+' / '+(req.min_quantity||0)+'개</strong></div>' +
                '<div class="progress-bar mt-8"><div class="fill" style="width:'+pct+'%"></div></div>' +
                '</div>' +
                '<div class="request-actions"><button class="btn btn-primary btn-sm" onclick="joinGroupPurchase(\''+req.id+'\')">참여하기</button></div>' +
                '</div>';
        }).join('');
    } catch(e) { console.error(e); container.innerHTML='<div class="empty-state"><p>오류가 발생했습니다.</p></div>'; }
}

var _postType = '', _postRating = 4;
function openCreatePost(type) {
    if (!AppState.currentUser) { openModal('loginModal'); return; }
    _postType = type; _postRating = 4;
    setEl('createPostTitle', type==='review' ? '✍️ 의뢰 후기 작성' : '🌟 생산자 홍보 등록');
    var rg = document.getElementById('postRatingGroup');
    if (rg) rg.style.display = type==='review' ? 'block' : 'none';
    setPostRating(4);
    var ti = document.getElementById('postTitleInput');   if (ti) ti.value = '';
    var ci = document.getElementById('postContentInput'); if (ci) ci.value = '';
    openModal('createPostModal');
}
function setPostRating(n) {
    _postRating = n;
    document.querySelectorAll('#postStarRating span').forEach(function(s,i){ s.style.opacity = i<n ? '1' : '0.3'; });
}
async function submitPost() {
    var title   = document.getElementById('postTitleInput')   ? document.getElementById('postTitleInput').value.trim()   : '';
    var content = document.getElementById('postContentInput') ? document.getElementById('postContentInput').value.trim() : '';
    if (!title || !content) { showToast('제목과 내용을 입력해주세요.','error'); return; }
    if (!AppState.currentUser) { closeModal('createPostModal'); openModal('loginModal'); return; }
    var btn = document.querySelector('#createPostModal .btn-primary');
    if (btn) { btn.disabled=true; btn.textContent='게시 중...'; }
    try {
        var p = AppState.currentProfile;
        var res = await window.supabaseClient.from('posts').insert([{
            user_id:     AppState.currentUser.id,
            post_type:   _postType,
            title:       title,
            content:     content,
            rating:      _postType === 'review' ? _postRating : null,
            author_name: p ? (p.nickname || '사용자') : '사용자',
            author_type: p ? p.user_type : ''
        }]);
        if (res.error) throw res.error;
        closeModal('createPostModal');
        showToast('게시물이 등록되었습니다! 🎉','success');
        if (_postType === 'review') loadMpReviews();
        else loadMpPromo();
    } catch(e) {
        showToast('등록 실패: '+e.message,'error');
    } finally {
        if (btn) { btn.disabled=false; btn.textContent='✏️ 게시'; }
    }
}

async function loadMpReviews() {
    var grid = document.getElementById('mp-reviews-grid');
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray)">⏳ 로딩 중...</div>';
    try {
        var res = await window.supabaseClient.from('posts')
            .select('*, manufacturer:profiles!manufacturer_id(nickname, specialty), request:requests!request_id(title, category)')
            .eq('post_type','review')
            .order('created_at',{ascending:false}).limit(30);
        if (res.error && res.error.code === 'PGRST200') {
            // FK 미정의 시 join 없이 재시도
            res = await window.supabaseClient.from('posts')
                .select('*').eq('post_type','review')
                .order('created_at',{ascending:false}).limit(30);
        }
        if (res.error) throw res.error;
        var list = res.data || [];
        if (!list.length) {
            grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">✍️</div><p>첫 번째 후기를 작성해보세요!</p></div>';
            return;
        }
        grid.innerHTML = list.map(function(post){ return renderFeedCard(post); }).join('');
    } catch(e) {
        console.error(e);
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>오류가 발생했습니다.</p></div>';
    }
}

async function loadMpPromo() {
    var grid = document.getElementById('mp-promo-grid');
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray)">⏳ 로딩 중...</div>';
    try {
        var res = await window.supabaseClient.from('posts')
            .select('*').eq('post_type','promo')
            .order('created_at',{ascending:false}).limit(30);
        if (res.error) throw res.error;
        var list = res.data || [];
        if (!list.length) {
            grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🌟</div><p>등록된 홍보가 없습니다.</p></div>';
            return;
        }
        grid.innerHTML = list.map(function(post){ return renderFeedCard(post); }).join('');
    } catch(e) {
        console.error(e);
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>오류가 발생했습니다.</p></div>';
    }
}

function renderFeedCard(post) {
    var date   = new Date(post.created_at).toLocaleDateString('ko-KR');
    var stars  = '';
    if (post.post_type === 'review' && post.rating) {
        stars = '<div style="color:#f39c12;font-size:15px;margin-top:4px">';
        for (var i = 0; i < 5; i++) stars += i < post.rating ? '★' : '☆';
        stars += '</div>';
    }
    var typeBadge = post.post_type === 'promo'
        ? '<span class="status-badge status-matched" style="margin-left:6px">생산자</span>'
        : '';

    // Phase 7: 거래 후기 컨텍스트 (생산자명 + 의뢰명)
    var txContext = '';
    if (post.post_type === 'review' && post.request_id) {
        var mfgName = (post.manufacturer && post.manufacturer.nickname) ? post.manufacturer.nickname : null;
        var reqTitle = (post.request && post.request.title) ? post.request.title : null;
        if (mfgName || reqTitle) {
            txContext = '<div class="text-xs" style="margin:6px 0 4px;padding:6px 8px;background:var(--bg);border-radius:4px;color:var(--gray)">' +
                (mfgName  ? '🏭 '+escHtml(mfgName)+' ' : '') +
                (reqTitle ? '· 📦 '+escHtml(reqTitle) : '') +
                '</div>';
        }
    }

    return '<div class="feed-card">' +
        '<div class="flex-between" style="margin-bottom:6px">' +
        '<div>' +
        '<strong style="font-size:14px">'+escHtml(post.author_name||'사용자')+'</strong>'+typeBadge+
        '<span class="text-xs text-muted" style="margin-left:6px">'+date+'</span>' +
        stars +
        '</div>' +
        '</div>' +
        txContext +
        '<h4 style="font-size:15px;font-weight:700;margin:8px 0 6px;color:var(--dark)">'+escHtml(post.title)+'</h4>' +
        '<p class="text-sm" style="color:var(--gray);line-height:1.65;white-space:pre-wrap;word-break:break-word">'+escHtml(post.content)+'</p>' +
        '</div>';
}
async function joinGroupPurchase(requestId) {
    if (!AppState.currentUser) { openModal('loginModal'); return; }
    _pendingGroupRequestId = requestId;
    var qtyEl = document.getElementById('join-group-qty');
    if (qtyEl) qtyEl.value = '1';
    var totalEl = document.getElementById('join-group-total');
    if (totalEl) totalEl.style.display = 'none';
    var summaryEl = document.getElementById('join-group-summary');
    if (summaryEl) summaryEl.innerHTML = '<div style="text-align:center;color:var(--gray)">⏳ 로딩 중...</div>';
    openModal('joinGroupModal');
    try {
        var res = await window.supabaseClient.from('requests')
            .select('title,category,quantity,min_quantity,current_quantity,target_price,recruit_deadline')
            .eq('id', requestId).single();
        if (res.error) throw res.error;
        var req = res.data;
        var remaining = Math.max(0, (req.min_quantity||0) - (req.current_quantity||0));
        var hintEl = document.getElementById('join-group-qty-hint');
        if (hintEl) hintEl.textContent = '최소 모집 잔여: '+remaining.toLocaleString()+'개';
        if (qtyEl) {
            qtyEl.oninput = function() {
                var qty = parseInt(this.value)||0;
                var totalDisp = document.getElementById('join-group-total');
                var totalAmt  = document.getElementById('join-group-total-amount');
                if (qty > 0 && req.target_price > 0) {
                    if (totalDisp) totalDisp.style.display = 'block';
                    if (totalAmt)  totalAmt.textContent = (qty * req.target_price).toLocaleString()+'원';
                } else {
                    if (totalDisp) totalDisp.style.display = 'none';
                }
            };
        }
        if (summaryEl) {
            var pct = req.min_quantity ? Math.min(100, Math.round((req.current_quantity||0)/req.min_quantity*100)) : 0;
            summaryEl.innerHTML =
                '<div class="flex-between" style="margin-bottom:10px">' +
                '<strong>'+escHtml(req.title)+'</strong>' +
                '<span class="status-badge status-recruiting">모집중</span>' +
                '</div>' +
                '<div class="request-meta">' +
                '<div class="meta-item">📦 '+escHtml(req.category||'-')+'</div>' +
                '<div class="meta-item">💰 희망 단가: <strong>'+(req.target_price||0).toLocaleString()+'원</strong></div>' +
                (req.recruit_deadline?'<div class="meta-item">📅 마감: <strong>'+req.recruit_deadline+'</strong></div>':'')+
                '</div>' +
                '<div style="margin-top:10px">' +
                '<div class="flex-between text-xs text-muted"><span>모집 현황</span><span>'+(req.current_quantity||0)+' / '+(req.min_quantity||0)+'개</span></div>' +
                '<div class="progress-bar mt-8"><div class="fill" style="width:'+pct+'%"></div></div>' +
                '</div>';
        }
    } catch(e) {
        if (summaryEl) summaryEl.innerHTML = '<p class="text-sm text-muted">정보를 불러올 수 없습니다.</p>';
    }
}

async function submitGroupParticipation() {
    if (!_pendingGroupRequestId) { showToast('오류: 의뢰 정보가 없습니다.','error'); return; }
    var qty = parseInt(document.getElementById('join-group-qty').value) || 0;
    if (qty < 1) { showToast('수량을 1개 이상 입력해주세요.','error'); return; }
    var btn = document.getElementById('joinGroupBtn');
    if (btn) { btn.disabled=true; btn.textContent='처리 중...'; }
    try {
        var partRes = await window.supabaseClient.from('group_participants').insert([{
            request_id: _pendingGroupRequestId,
            user_id:    AppState.currentUser.id,
            quantity:   qty
        }]);
        if (partRes.error) {
            if (partRes.error.code === '23505') throw new Error('이미 이 공동구매에 참여하셨습니다.');
            throw partRes.error;
        }
        // 현재 수량 갱신 (read-modify-write; 단일 사용자 환경에서 충분)
        var reqRes = await window.supabaseClient.from('requests')
            .select('current_quantity').eq('id', _pendingGroupRequestId).single();
        var newQty = ((reqRes.data ? reqRes.data.current_quantity : 0) || 0) + qty;
        await window.supabaseClient.from('requests')
            .update({ current_quantity: newQty }).eq('id', _pendingGroupRequestId);
        closeModal('joinGroupModal');
        showToast('공동구매에 참여했습니다! 🎉','success');
        loadMpGroupRequests();
        loadPersonalDashboard();
    } catch(e) {
        showToast('참여 실패: '+e.message,'error');
    } finally {
        if (btn) { btn.disabled=false; btn.textContent='👥 참여하기'; }
    }
}

// ── 스텝 ───────────────────────────────────────────────
function bizStepNext(step) {
    if (step===1) {
        var valid=true;
        [['fg-biz-title','biz-title'],['fg-biz-category','biz-category'],['fg-biz-qty','biz-qty'],['fg-biz-price','biz-price'],['fg-biz-deadline','biz-deadline']].forEach(function(p){
            var el=document.getElementById(p[1]),fg=document.getElementById(p[0]);
            if(el&&!el.value.trim()){if(fg)fg.classList.add('error');valid=false;}
            else{if(fg)fg.classList.remove('error');}
        });
        if(!valid){showToast('필수 항목을 입력해주세요.','error');return;}
    }
    document.getElementById('biz-step-'+step).style.display='none';
    document.getElementById('biz-step-'+(step+1)).style.display='block';
    AppState.bizCurrentStep=step+1; updateBizStepper();
    if(step===2) populateBizConfirm();
}
function bizStepBack(step) {
    document.getElementById('biz-step-'+step).style.display='none';
    document.getElementById('biz-step-'+(step-1)).style.display='block';
    AppState.bizCurrentStep=step-1; updateBizStepper();
}
function updateBizStepper() {
    document.querySelectorAll('#bizStepper .step').forEach(function(s,i){
        s.classList.remove('active','done');
        if(i+1<AppState.bizCurrentStep)s.classList.add('done');
        else if(i+1===AppState.bizCurrentStep)s.classList.add('active');
    });
    document.querySelectorAll('#bizStepper .step-line').forEach(function(l,i){
        l.classList.toggle('done',i+1<AppState.bizCurrentStep);
    });
}
function populateBizConfirm() {
    var qty=document.getElementById('biz-qty').value, price=document.getElementById('biz-price').value;
    setEl('confirm-title',   document.getElementById('biz-title').value);
    setEl('confirm-category',document.getElementById('biz-category').value);
    setEl('confirm-qty',     Number(qty).toLocaleString()+'개');
    setEl('confirm-price',   Number(price).toLocaleString()+'원');
    setEl('confirm-deadline',document.getElementById('biz-deadline').value);
    setEl('confirm-total',   (Number(qty)*Number(price)).toLocaleString()+'원');
    setEl('confirm-guide',   document.getElementById('biz-design-guide').value||'-');
    setEl('confirm-note',    document.getElementById('biz-detail-note').value||'-');
    var fi=document.getElementById('biz-file-input');
    setEl('confirm-files',fi&&fi.files.length>0?Array.from(fi.files).map(function(f){return f.name;}).join(', '):'없음');
}
function resetBizForm() {
    ['biz-title','biz-qty','biz-price','biz-deadline','biz-design-guide','biz-detail-note'].forEach(function(id){
        var el=document.getElementById(id);if(el)el.value='';
    });
    var cat=document.getElementById('biz-category');if(cat)cat.value='';
    document.getElementById('biz-step-3').style.display='none';
    document.getElementById('biz-step-2').style.display='none';
    document.getElementById('biz-step-1').style.display='block';
    AppState.bizCurrentStep=1; updateBizStepper();
}

// ── 기타 UI ────────────────────────────────────────────
function toggleDirectMfg(radio) {
    var f=document.getElementById('directMfgField');if(f)f.style.display=radio.value==='direct'?'block':'none';
    var rb=document.getElementById('radio-bidding'),rd=document.getElementById('radio-direct');
    if(rb)rb.style.borderColor=radio.value==='bidding'?'var(--primary)':'#E2E8F0';
    if(rd)rd.style.borderColor=radio.value==='direct'?'var(--primary)':'#E2E8F0';
}
function toggleGroupDirectMfg(radio){var f=document.getElementById('groupDirectMfgField');if(f)f.style.display=radio.value==='direct'?'block':'none';}
function showUploadedFiles(input,listId){
    var list=document.getElementById(listId);if(!list)return;
    list.innerHTML='';
    Array.from(input.files).forEach(function(f){
        var div=document.createElement('div');
        div.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg);border-radius:6px;margin-bottom:4px;font-size:13px';
        div.innerHTML='<span>📎 '+escHtml(f.name)+' ('+(f.size/1024/1024).toFixed(1)+'MB)</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px">×</button>';
        list.appendChild(div);
    });
}
function setRating(n){document.querySelectorAll('#starRating span').forEach(function(s,i){s.style.opacity=i<n?'1':'0.3';});}
function setEl(id,val){var el=document.getElementById(id);if(el)el.textContent=val;}
function openModal(id){var el=document.getElementById(id);if(el)el.classList.add('show');}
function closeModal(id){var el=document.getElementById(id);if(el)el.classList.remove('show');}
function closeDropdown(){var d=document.getElementById('profileDropdown');if(d)d.classList.remove('show');}
function toggleUserMenu(e){if(e)e.stopPropagation();var d=document.getElementById('profileDropdown');if(d)d.classList.toggle('show');}
function showToast(message,type){
    var t=document.getElementById('toast');if(!t)return;
    t.textContent=message; t.className='toast '+(type||'info')+' show';
    clearTimeout(t._timer); t._timer=setTimeout(function(){t.classList.remove('show');},3500);
}
function escHtml(str){
    if(!str)return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// =====================================================
// Phase 4: 거래 완결성 (Transaction Closure)
// =====================================================

// 생산자 입찰 상세에 표시할 결제·배송 정보
function renderMfgTransactionSection(bid, req) {
    if (!req || !req.payment_status || req.payment_status === 'unpaid') return '';
    var rows = '<div class="divider"></div>' +
        '<h5 style="margin-bottom:12px;font-size:13px;color:var(--gray);text-transform:uppercase;letter-spacing:0.5px">결제 / 배송 / 정산</h5>' +
        '<table class="data-table mb-16">' +
        (req.paid_at?'<tr><td style="width:120px;font-weight:600">결제일</td><td>'+new Date(req.paid_at).toLocaleString('ko-KR')+'</td></tr>':'')+
        (req.payment_amount?'<tr><td style="font-weight:600">매칭 금액</td><td class="text-primary fw-bold">'+Number(req.payment_amount).toLocaleString()+'원</td></tr>':'')+
        '<tr><td style="font-weight:600">정산 상태</td><td>'+(req.payment_status==='released'?'<span class="badge" style="background:#d1fae5;color:#065f46">정산 완료</span>':'<span class="badge" style="background:#fef3c7;color:#92400e">에스크로 보관 중 (수령 확인 대기)</span>')+'</td></tr>' +
        (req.tracking_number?'<tr><td style="font-weight:600">송장번호</td><td><code>'+escHtml(req.tracking_number)+'</code></td></tr>':'')+
        (req.shipped_at?'<tr><td style="font-weight:600">배송 시작일</td><td>'+new Date(req.shipped_at).toLocaleString('ko-KR')+'</td></tr>':'')+
        (req.completed_at?'<tr><td style="font-weight:600">정산 완료일</td><td>'+new Date(req.completed_at).toLocaleString('ko-KR')+'</td></tr>':'')+
        '</table>';
    return rows;
}

// 생산자 입찰 상세에서 노출할 액션 버튼 (선정된 본인 입찰만)
function renderMfgActionButtons(bid, req) {
    if (!bid || bid.status !== 'selected' || !req) return '';
    if (req.status === 'matched') {
        return '<button class="btn btn-primary" onclick="startProductionAction(\''+req.id+'\')">🏭 제작 시작</button>';
    }
    if (req.status === 'producing') {
        return '<button class="btn btn-primary" onclick="openShipModal(\''+req.id+'\')">🚚 배송 시작 (송장 입력)</button>';
    }
    return '';
}

async function startProductionAction(requestId) {
    if (!confirm('제작을 시작하시겠습니까?\n의뢰자에게 알림이 전달됩니다.')) return;
    try {
        await Requests.startProduction(requestId);
        // 의뢰자에게 알림
        try {
            var r = await window.supabaseClient.from('requests').select('user_id, title').eq('id', requestId).single();
            if (!r.error && r.data) {
                await Notifications.create(r.data.user_id, 'status_changed', '🏭 제작이 시작되었습니다', '['+r.data.title+'] 제작이 시작되었습니다.', requestId);
            }
        } catch(ne){ console.warn('알림 실패:', ne.message); }
        closeModal('mfgBidDetailModal');
        showToast('🏭 제작 시작 처리 완료','success');
        loadMfgBids();
        loadMfgDashboard();
    } catch(e) {
        showToast('오류: '+e.message,'error');
    }
}

function openShipModal(requestId) {
    var hidden = document.getElementById('shipRequestId');
    var input  = document.getElementById('shipTrackingNumber');
    if (hidden) hidden.value = requestId;
    if (input)  input.value  = '';
    openModal('shipModal');
}

async function submitShipping() {
    var requestId = (document.getElementById('shipRequestId')||{}).value;
    var tracking  = ((document.getElementById('shipTrackingNumber')||{}).value || '').trim();
    var carrier   = (document.getElementById('shipCarrier')||{}).value || '';
    if (!requestId) { showToast('의뢰 정보 누락','error'); return; }
    if (!tracking)  { showToast('송장번호를 입력해주세요','error'); return; }
    var btn = document.getElementById('shipSubmitBtn');
    if (btn) { btn.disabled=true; btn.textContent='처리 중...'; }
    try {
        var fullTracking = carrier ? (carrier+' '+tracking) : tracking;
        await Requests.markShipped(requestId, fullTracking);
        try {
            var r = await window.supabaseClient.from('requests').select('user_id, title').eq('id', requestId).single();
            if (!r.error && r.data) {
                await Notifications.create(r.data.user_id, 'status_changed', '🚚 배송이 시작되었습니다', '['+r.data.title+'] 송장: '+fullTracking, requestId);
            }
        } catch(ne){ console.warn('알림 실패:', ne.message); }
        closeModal('shipModal');
        closeModal('mfgBidDetailModal');
        showToast('🚚 배송 시작 처리 완료','success');
        loadMfgBids();
        loadMfgDashboard();
    } catch(e) {
        showToast('오류: '+e.message,'error');
    } finally {
        if (btn) { btn.disabled=false; btn.textContent='🚚 배송 시작'; }
    }
}

async function confirmDeliveryAction(requestId) {
    if (!confirm('수령 확인 시 정산이 완료되며, 거래가 종료됩니다.\n계속하시겠습니까?')) return;
    try {
        await Requests.confirmDelivery(requestId);
        // 생산자에게 정산 완료 알림
        try {
            var r = await window.supabaseClient.from('requests').select('matched_bid_id, title').eq('id', requestId).single();
            if (!r.error && r.data && r.data.matched_bid_id) {
                var b = await window.supabaseClient.from('bids').select('manufacturer_id').eq('id', r.data.matched_bid_id).single();
                if (!b.error && b.data) {
                    await Notifications.create(b.data.manufacturer_id, 'status_changed', '✅ 거래가 완료되었습니다', '['+r.data.title+'] 의뢰자가 수령을 확인하여 정산이 완료되었습니다.', requestId);
                }
            }
        } catch(ne){ console.warn('알림 실패:', ne.message); }
        closeModal('requestDetailModal');
        showToast('📦 수령 확인 완료, 정산이 완료되었습니다','success');
        await loadMyRequests('business');
        await loadMyRequests('personal');
        loadBizDashboard();
        loadPersonalDashboard();
        // Phase 7: 거래 후기 작성 모달 자동 오픈
        setTimeout(function(){ openReviewModal(requestId); }, 600);
    } catch(e) {
        showToast('오류: '+e.message,'error');
    }
}

// ── 결제·정산 탭 렌더 ────────────────────────────────────
async function loadMfgPayments() {
    var box = document.getElementById('mfg-payments-body');
    if (!box) return;
    if (!AppState.currentUser) {
        box.innerHTML = '<div class="empty-state"><div class="empty-icon">🔐</div><p>로그인 후 확인할 수 있습니다.</p></div>';
        return;
    }
    box.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>로딩 중...</p></div>';
    var list = await Requests.getPaymentHistory('manufacturer');
    if (!list.length) {
        box.innerHTML = '<div class="empty-state"><div class="empty-icon">💳</div><p>정산 내역이 없습니다.</p></div>';
        return;
    }
    var rows = list.map(function(r){
        var statusBadge = r.payment_status==='released'
            ? '<span class="badge" style="background:#d1fae5;color:#065f46">정산 완료</span>'
            : '<span class="badge" style="background:#fef3c7;color:#92400e">에스크로 보관 중</span>';
        var amt = r.payment_amount ? Number(r.payment_amount).toLocaleString()+'원' : '-';
        return '<tr>' +
            '<td>'+(r.paid_at?new Date(r.paid_at).toLocaleDateString('ko-KR'):'-')+'</td>' +
            '<td>'+escHtml(r.title||'-')+'</td>' +
            '<td class="text-primary fw-bold">'+amt+'</td>' +
            '<td>'+statusBadge+'</td>' +
            '<td>'+(r.completed_at?new Date(r.completed_at).toLocaleDateString('ko-KR'):'-')+'</td>' +
            '</tr>';
    }).join('');
    box.innerHTML = '<table class="data-table">' +
        '<thead><tr><th>매칭일</th><th>의뢰명</th><th>금액</th><th>정산 상태</th><th>정산일</th></tr></thead>' +
        '<tbody>'+rows+'</tbody></table>';
}

async function loadClientPayments(bodyId) {
    var box = document.getElementById(bodyId);
    if (!box) return;
    if (!AppState.currentUser) {
        box.innerHTML = '<div class="empty-state"><div class="empty-icon">🔐</div><p>로그인 후 확인할 수 있습니다.</p></div>';
        return;
    }
    box.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>로딩 중...</p></div>';
    var list = await Requests.getPaymentHistory('client');
    if (!list.length) {
        box.innerHTML = '<div class="empty-state"><div class="empty-icon">💳</div><p>결제 내역이 없습니다.</p></div>';
        return;
    }
    var rows = list.map(function(r){
        var statusBadge = r.payment_status==='released'
            ? '<span class="badge" style="background:#d1fae5;color:#065f46">정산 완료</span>'
            : (r.payment_status==='paid'
                ? '<span class="badge" style="background:#fef3c7;color:#92400e">에스크로 보관 중</span>'
                : '<span class="badge">'+escHtml(r.payment_status)+'</span>');
        var amt = r.payment_amount ? Number(r.payment_amount).toLocaleString()+'원' : '-';
        return '<tr>' +
            '<td>'+(r.paid_at?new Date(r.paid_at).toLocaleDateString('ko-KR'):'-')+'</td>' +
            '<td>'+escHtml(r.title||'-')+'</td>' +
            '<td>'+escHtml(r.payment_method||'-')+'</td>' +
            '<td class="text-primary fw-bold">'+amt+'</td>' +
            '<td>'+statusBadge+'</td>' +
            '<td>'+(r.completed_at?new Date(r.completed_at).toLocaleDateString('ko-KR'):'-')+'</td>' +
            '</tr>';
    }).join('');
    box.innerHTML = '<table class="data-table">' +
        '<thead><tr><th>결제일</th><th>의뢰명</th><th>결제수단</th><th>금액</th><th>상태</th><th>거래완료일</th></tr></thead>' +
        '<tbody>'+rows+'</tbody></table>';
}

function loadBizPayments()      { return loadClientPayments('biz-payments-body'); }
function loadPersonalPayments() { return loadClientPayments('personal-payments-body'); }

// ── Phase 7: 거래 후기 모달 핸들러 ──────────────────────
var _reviewRating = 4;
function setReviewRating(n) {
    _reviewRating = n;
    document.querySelectorAll('#reviewStarRating span').forEach(function(s,i){
        s.style.opacity = i < n ? '1' : '0.3';
    });
    var lbl = document.getElementById('reviewRatingLabel');
    if (lbl) lbl.textContent = '★ '+n+'점';
}

async function openReviewModal(requestId) {
    if (!AppState.currentUser) { openModal('loginModal'); return; }
    try {
        if (await Reviews.hasReviewed(requestId)) {
            showToast('이미 후기를 작성하셨습니다.', 'info');
            return;
        }
        var req = await Requests.getById(requestId);
        if (!req) { showToast('의뢰를 찾을 수 없습니다.', 'error'); return; }
        if (req.status !== 'completed') {
            showToast('거래가 완료된 의뢰만 후기를 작성할 수 있습니다.', 'error');
            return;
        }
        var bid = (req.bids || []).find(function(b){ return b.id === req.matched_bid_id; });
        if (!bid) { showToast('매칭된 입찰 정보를 찾을 수 없습니다.', 'error'); return; }

        var mfgName = (bid.manufacturer && bid.manufacturer.nickname)
            ? bid.manufacturer.nickname
            : (bid.manufacturer_name || '생산자');

        var rid = document.getElementById('reviewRequestId');
        var mid = document.getElementById('reviewManufacturerId');
        var bidEl = document.getElementById('reviewBidId');
        if (rid)   rid.value = req.id;
        if (mid)   mid.value = bid.manufacturer_id;
        if (bidEl) bidEl.value = bid.id;

        var mfgLbl = document.getElementById('reviewMfgLabel');
        var reqLbl = document.getElementById('reviewRequestLabel');
        if (mfgLbl) mfgLbl.textContent = mfgName;
        if (reqLbl) reqLbl.textContent = '['+(req.category||'기타')+'] '+(req.title||'-');

        var titleIn = document.getElementById('reviewTitle');
        var contIn  = document.getElementById('reviewContent');
        if (titleIn) titleIn.value = '';
        if (contIn)  contIn.value  = '';
        setReviewRating(4);
        openModal('writeReviewModal');
    } catch(e) {
        console.error(e);
        showToast('후기 모달 오픈 실패: '+e.message, 'error');
    }
}

async function submitReview() {
    var requestId      = (document.getElementById('reviewRequestId')||{}).value;
    var manufacturerId = (document.getElementById('reviewManufacturerId')||{}).value;
    var bidId          = (document.getElementById('reviewBidId')||{}).value;
    var title          = (document.getElementById('reviewTitle')||{}).value || '';
    var content        = (document.getElementById('reviewContent')||{}).value || '';

    if (!title.trim() || !content.trim()) {
        showToast('제목과 내용을 입력해주세요.', 'error');
        return;
    }
    if (!requestId || !manufacturerId) {
        showToast('의뢰/생산자 정보가 없습니다.', 'error');
        return;
    }

    var btn = document.getElementById('reviewSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = '등록 중...'; }
    try {
        await Reviews.submit({
            requestId:      requestId,
            manufacturerId: manufacturerId,
            bidId:          bidId || null,
            rating:         _reviewRating,
            title:          title.trim(),
            content:        content.trim()
        });
        closeModal('writeReviewModal');
        showToast('후기가 등록되었습니다! 🎉', 'success');
        try { await loadMyRequests('business'); } catch(e){}
        try { await loadMyRequests('personal'); } catch(e){}
        try { await loadMpReviews(); } catch(e){}
    } catch(e) {
        showToast('후기 등록 실패: '+e.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '✍️ 후기 등록'; }
    }
}

document.addEventListener('click',function(e){
    var d=document.getElementById('profileDropdown');
    if(d&&d.classList.contains('show')&&!e.target.closest('.nav-user'))d.classList.remove('show');
});
document.addEventListener('DOMContentLoaded', initApp);
